// Called only after the native package/launch/lifecycle checks have succeeded.
// Keep downloaded instructions tied to this artifact rather than a previous run.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const release = path.join(root, 'release');
const manifest = JSON.parse(await fs.readFile(path.join(release, 'verification.json'), 'utf8').then(s => s.replace(/^\uFEFF/, '')));
const run = manifest.windowsValidation?.runUrl;
if (!manifest.windowsLaunchVerified || !manifest.installerLifecycleVerified || !manifest.portableLauncherVerified ||
    manifest.sourceDirty || manifest.archiveIntegrity !== 'passed' || !manifest.bundledCodeMatchesBuild ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) ||
    typeof run !== 'string' || !/^https:\/\/github\.com\/hectorantunes07-cyber\/Pandora\/actions\/runs\/\d+$/.test(run)) {
  throw new Error('Native Windows validation must succeed before preparing download instructions.');
}
for (const file of ['docs/WINDOWS-QUICKSTART.md', 'docs/windows-validation.md', 'docs/WINDOWS-HANDOFF.md', 'docs/FORTNITE-SETTINGS.md', 'FEATURES.md']) {
  let text = await fs.readFile(path.join(root, file), 'utf8');
  if (file.endsWith('WINDOWS-HANDOFF.md')) {
    if (!/Application source: `[a-f0-9]{40}`/.test(text)) throw new Error('The handoff source marker is missing.');
    text = text.replace(/Application source: `[a-f0-9]{40}`/, `Application source: \`${manifest.sourceCommit}\``)
      .replace(/https:\/\/github\.com\/hectorantunes07-cyber\/Pandora\/actions\/runs\/\d+/g, run)
      .replaceAll('(../FEATURES.md)', '(FEATURES.md)');
  }
  await fs.writeFile(path.join(release, path.basename(file)), text);
}
console.log(`Prepared Windows download instructions for ${manifest.sourceCommit}.`);
