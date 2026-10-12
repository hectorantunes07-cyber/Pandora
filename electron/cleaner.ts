import { randomUUID } from 'node:crypto';
import type { CleanupKind, CleanupScan, CleanupResult, ProgressEvent } from '../shared/types';
import { createNativeCleanerAdapter, type CleanerAdapter, type NativeScan } from './cleaner-native';

const TTL_MS = 10 * 60 * 1000;
const KINDS = new Set<CleanupKind>(['safe', 'browser', 'recycle']);
type Snapshot = { kind: CleanupKind; created: number; data: NativeScan };
export interface CleanerOptions { adapter?: CleanerAdapter; now?: () => number; id?: () => string }

/** Snapshots and paths stay in the main process. The renderer receives category
 * summaries and can request only IDs from a single-use, expiring snapshot. */
export function createCleanerService(onProgress: (event: ProgressEvent) => void, options: CleanerOptions = {}) {
  const adapter = options.adapter ?? createNativeCleanerAdapter();
  const now = options.now ?? Date.now, id = options.id ?? randomUUID;
  const snapshots = new Map<string, Snapshot>();
  let busy = false;
  function progress(event: ProgressEvent) { try { onProgress(event); } catch { /* UI cannot interrupt file accounting */ } }
  function purge() { for (const [key, snapshot] of snapshots) if (now() - snapshot.created > TTL_MS) snapshots.delete(key); }
  function validateKind(kind: CleanupKind) { if (!KINDS.has(kind)) throw new Error('Choose a supported cleanup category.'); }
  function validateBytes(bytes: number) { if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Windows returned an invalid file size. No files were changed.'); return bytes; }
  return {
    async scanCleanup(kind: CleanupKind): Promise<CleanupScan> {
      validateKind(kind);
      if (busy) throw new Error('Another cleaner operation is running. Please wait.');
      busy = true;
      try {
        purge(); progress({ operation: 'scan', completed: 0, total: null, message: 'Inspecting approved cleanup locations…' });
        const data = await adapter.scan(kind);
        const categoryIds = new Set<string>(), paths = new Set<string>();
        const categories = data.groups.map(group => {
          if (categoryIds.has(group.id)) throw new Error('Duplicate cleanup category. Please rescan.');
          categoryIds.add(group.id);
          let total = 0;
          for (const file of group.files) {
            if (file.categoryId !== group.id || paths.has(file.path.toLowerCase())) throw new Error('Unsafe or duplicate scan result. No files were changed.');
            paths.add(file.path.toLowerCase()); total = validateBytes(total + validateBytes(file.bytes));
          }
          return { id: group.id, title: group.title, description: group.description, paths: [...group.roots], bytes: kind === 'recycle' ? validateBytes(group.bytes ?? 0) : total, fileCount: kind === 'recycle' ? validateBytes(group.fileCount ?? 0) : group.files.length };
        });
        const scanId = id(), created = now();
        // Bound memory and invalidate older scans of this kind.
        for (const [key, snapshot] of snapshots) if (snapshot.kind === kind) snapshots.delete(key);
        snapshots.set(scanId, { kind, created, data: structuredClone(data) });
        const count = categories.reduce((sum, group) => sum + group.fileCount, 0);
        progress({ operation: 'scan', completed: count, total: count, message: 'Scan complete. Review your categories before cleaning.' });
        return { id: scanId, kind, timestamp: new Date(created).toISOString(), categories, warnings: [...data.warnings] };
      } finally { busy = false; }
    },
    async clean(scanId: string, categoryIds: string[], confirmation: CleanupKind): Promise<CleanupResult> {
      validateKind(confirmation); purge();
      if (busy) throw new Error('Another cleaner operation is running. Please wait.');
      const snapshot = snapshots.get(scanId);
      if (!snapshot) throw new Error('This scan expired or was already used. Scan again before cleaning.');
      if (snapshot.kind !== confirmation) throw new Error('Separate confirmation is required for this cleanup type.');
      if (!Array.isArray(categoryIds) || !categoryIds.length || categoryIds.some(value => typeof value !== 'string') || new Set(categoryIds).size !== categoryIds.length) throw new Error('Select at least one valid cleanup category.');
      if (categoryIds.some(category => !snapshot.data.groups.some(group => group.id === category))) throw new Error('A selected category is not in this scan.');
      const files = snapshot.data.groups.filter(group => categoryIds.includes(group.id)).flatMap(group => group.files);
      busy = true; snapshots.delete(scanId);
      const result: CleanupResult = { kind: confirmation, deletedBytes: 0, deletedFiles: 0, skippedFiles: 0, failures: [], recoveredBytes: null };
      const expected = new Map(files.map(file => [file.path, file]));
      let completed = 0;
      let recycleReported = false;
      const total = confirmation === 'recycle' ? 1 : files.length;
      progress({ operation: 'clean', completed, total, message: confirmation === 'recycle' ? 'Waiting for Windows Recycle Bin confirmation…' : 'Cleaning the files you selected…' });
      try {
        await adapter.remove(confirmation, files, outcome => {
          if (!outcome || typeof outcome.path !== 'string' || typeof outcome.deleted !== 'boolean') throw new Error('Windows returned an invalid cleanup result.');
          const candidate = expected.get(outcome.path);
          if (confirmation === 'recycle') {
            if (recycleReported || outcome.path !== 'Recycle Bin') throw new Error('Unexpected duplicate or unknown Recycle Bin result.');
            const bytes = validateBytes(outcome.bytes);
            const removed = validateBytes(outcome.deletedFiles ?? 0);
            recycleReported = true;
            // Native shell cleanup can partially succeed. Report the observed
            // before/after change even if Windows also reports cancellation/error.
            result.deletedBytes = bytes;
            result.deletedFiles = removed;
            if (!outcome.deleted) result.failures.push({ path: outcome.path, reason: outcome.reason || 'Windows did not complete Recycle Bin cleanup.' });
          } else {
            if (!candidate) throw new Error('Unexpected duplicate or unknown cleanup result.');
            if (outcome.deleted) {
              validateBytes(outcome.bytes);
              if (outcome.bytes !== candidate.bytes) throw new Error('Deleted-file accounting did not match the scan.');
              const totalBytes = validateBytes(result.deletedBytes + outcome.bytes);
              result.deletedBytes = totalBytes;
              result.deletedFiles++;
            } else {
              result.skippedFiles++;
              result.failures.push({ path: outcome.path, reason: outcome.reason || 'Windows could not delete this file safely.' });
            }
            expected.delete(outcome.path);
          }
          completed++;
          progress({ operation: 'clean', completed, total, message: confirmation === 'recycle' ? 'Windows finished processing the Recycle Bin.' : `${completed} of ${total} files processed` });
        });
        if (confirmation === 'recycle' && !recycleReported) throw new Error('Windows did not return a Recycle Bin result; cleanup could not be confirmed.');
        if (expected.size) throw new Error('Windows did not finish reporting every file.');
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Cleaner interrupted.';
        for (const file of expected.values()) { result.skippedFiles++; result.failures.push({ path: file.path, reason: `Not confirmed deleted: ${reason}` }); }
        if (!expected.size) result.failures.push({ path: 'Cleanup', reason });
      } finally { busy = false; }
      progress({ operation: 'clean', completed, total, message: result.failures.length ? 'Cleanup finished with skipped or unconfirmed items.' : 'Cleanup complete.' });
      return result;
    },
  };
}
