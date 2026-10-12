import { spawn } from 'node:child_process';
import type { CleanupKind } from '../shared/types';

export interface Candidate { path: string; root: string; bytes: number; identity: string; modified: string; categoryId: string }
export interface ScanGroup { id: string; title: string; description: string; roots: string[]; files: Candidate[]; bytes?: number; fileCount?: number }
export interface NativeScan { groups: ScanGroup[]; warnings: string[] }
export interface FileOutcome { path: string; deleted: boolean; bytes: number; deletedFiles?: number; reason?: string }
export interface CleanerAdapter {
  scan(kind: CleanupKind): Promise<NativeScan>;
  remove(kind: CleanupKind, files: Candidate[], onFile: (outcome: FileOutcome) => void): Promise<void>;
}

// The command is fixed application code. Paths/identities are data over stdin,
// never interpolated into PowerShell. No shell or arbitrary commands are exposed.
export const CLEANER_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$source = @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public class PandoraFile {
  public string path; public string root; public long bytes; public string identity; public string modified; public string categoryId;
}
public class PandoraGroup {
  public string id; public string title; public string description; public string[] roots;
  public List<PandoraFile> files = new List<PandoraFile>(); public long bytes; public long fileCount;
}
public class PandoraScan {
  public List<PandoraGroup> groups = new List<PandoraGroup>(); public List<string> warnings = new List<string>();
}
public class PandoraOutcome { public string path; public bool deleted; public long bytes; public long deletedFiles; public string reason; }
public static class PandoraCleaner {
  const uint READ_ATTRIBUTES = 0x80, DELETE = 0x10000, SHARE_READ = 1;
  const uint OPEN_EXISTING = 3, BACKUP_SEMANTICS = 0x02000000, OPEN_REPARSE_POINT = 0x00200000;
  const uint REPARSE = 0x400, DIRECTORY = 0x10, OFFLINE = 0x1000;
  const int LIMIT = 30000;
  [StructLayout(LayoutKind.Sequential)] struct FILETIME { public uint low; public uint high; }
  [StructLayout(LayoutKind.Sequential)] struct INFO {
    public uint attributes; public FILETIME creation; public FILETIME access; public FILETIME write;
    public uint volume; public uint sizeHigh; public uint sizeLow; public uint links; public uint indexHigh; public uint indexLow;
  }
  [StructLayout(LayoutKind.Sequential)] struct DISPOSITION { [MarshalAs(UnmanagedType.Bool)] public bool DeleteFile; }
  [StructLayout(LayoutKind.Sequential, Pack=8)] struct BININFO { public uint cbSize; public long size; public long count; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle file, out INFO info);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFileInformationByHandle(SafeFileHandle file, int infoClass, ref DISPOSITION info, uint size);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern int SHQueryRecycleBin(string root, ref BININFO info);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern int SHEmptyRecycleBin(IntPtr hwnd, string root, uint flags);
  static string Local { get { return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); } }
  static string Windows { get { return Environment.GetFolderPath(Environment.SpecialFolder.Windows); } }
  static string Full(string path) {
    if (String.IsNullOrWhiteSpace(path) || path.StartsWith(@"\\") || path.IndexOf(':', 2) >= 0) throw new IOException("Only local, ordinary Windows paths are supported.");
    string result = Path.GetFullPath(path).TrimEnd('\\');
    if (result.Length < 3 || result[1] != ':' || result[2] != '\\') throw new IOException("Unsafe path.");
    foreach(string part in result.Substring(3).Split('\\')) if (part.EndsWith(".") || part.EndsWith(" ")) throw new IOException("Ambiguous path.");
    return result;
  }
  static string Join(string parent, string child) { if (String.IsNullOrWhiteSpace(parent)) throw new IOException("Windows folder unavailable."); return Full(Path.Combine(parent, child)); }
  static string Identity(INFO info) { return info.volume.ToString("X8") + ":" + info.indexHigh.ToString("X8") + info.indexLow.ToString("X8") + ":" + info.creation.high.ToString("X8") + info.creation.low.ToString("X8"); }
  static string Modified(INFO info) { return info.write.high.ToString("X8") + info.write.low.ToString("X8"); }
  static long Size(INFO info) { return ((long)info.sizeHigh << 32) | info.sizeLow; }
  static DateTime ModifiedDate(INFO info) { return DateTime.FromFileTimeUtc(((long)info.write.high << 32) | info.write.low); }
  static SafeFileHandle Open(string path, bool directory, bool deleting, out INFO info) {
    // Deny sharing for writes and deletes. A pre-existing writer causes a safe skip.
    SafeFileHandle h = CreateFile(path, READ_ATTRIBUTES | (deleting ? DELETE : 0), deleting ? 0 : SHARE_READ, IntPtr.Zero, OPEN_EXISTING, BACKUP_SEMANTICS | OPEN_REPARSE_POINT, IntPtr.Zero);
    if (h.IsInvalid) { h.Dispose(); throw new IOException("Locked, missing, or inaccessible (Windows " + Marshal.GetLastWin32Error() + ")."); }
    if (!GetFileInformationByHandle(h, out info)) { h.Dispose(); throw new IOException("Could not verify file identity."); }
    if ((info.attributes & (REPARSE | OFFLINE)) != 0 || (((info.attributes & DIRECTORY) != 0) != directory)) { h.Dispose(); throw new IOException("Links, offline files, and unexpected file types are excluded."); }
    if (!directory && info.links != 1) { h.Dispose(); throw new IOException("Hard-linked files are excluded."); }
    return h;
  }
  // Lock every ancestor while inspecting/deleting. Renaming a parent, replacing it
  // with a junction, or editing its reparse data cannot redirect a deletion.
  static List<SafeFileHandle> LockParents(string path) {
    List<SafeFileHandle> held = new List<SafeFileHandle>();
    try {
      string parent = Path.GetDirectoryName(Full(path));
      string current = Path.GetPathRoot(parent);
      INFO info; held.Add(Open(current, true, false, out info));
      foreach(string part in parent.Substring(current.Length).Split(new char[]{'\\'}, StringSplitOptions.RemoveEmptyEntries)) {
        current = Path.Combine(current, part); held.Add(Open(current, true, false, out info));
      }
      return held;
    } catch { Release(held); throw; }
  }
  static void Release(List<SafeFileHandle> held) { foreach(SafeFileHandle h in held) h.Dispose(); }
  static void AddGroup(PandoraScan scan, string id, string title, string description, string root, bool browser) {
    PandoraGroup group = scan.groups.Find(g => g.id == id);
    if(group == null) { group = new PandoraGroup {id=id, title=title, description=description, roots=new string[0]}; scan.groups.Add(group); }
    var roots = new List<string>(group.roots); roots.Add(root); group.roots=roots.ToArray();
    Walk(root, root, group, scan.warnings, browser, 0);
    group.bytes=0; group.fileCount=group.files.Count; foreach(var file in group.files) group.bytes += file.bytes;
  }
  static void Walk(string directory, string root, PandoraGroup group, List<string> warnings, bool browser, int depth) {
    if(depth > 20 || group.files.Count >= LIMIT) { warnings.Add("Scan limit reached for " + group.title + "; rescan after cleanup."); return; }
    if(!Directory.Exists(directory)) return;
    List<SafeFileHandle> parents=null; SafeFileHandle handle=null;
    try {
      parents=LockParents(directory); INFO info; handle=Open(directory,true,false,out info);
      foreach(string path in Directory.EnumerateFileSystemEntries(directory)) {
        if(group.files.Count >= LIMIT) { warnings.Add("Scan limit reached; some files were not scanned."); break; }
        FileAttributes attributes;
        try { attributes=File.GetAttributes(path); } catch { warnings.Add("Could not inspect " + path); continue; }
        if((attributes & (FileAttributes.ReparsePoint | FileAttributes.Offline)) != 0) { warnings.Add("Excluded link or offline entry: " + path); continue; }
        if((attributes & FileAttributes.Directory) != 0) { Walk(path,root,group,warnings,browser,depth+1); continue; }
        string extension=Path.GetExtension(path);
        // Temp cleanup is deliberately conservative: stale .tmp/.temp only.
        if(!browser && !extension.Equals(".tmp",StringComparison.OrdinalIgnoreCase) && !extension.Equals(".temp",StringComparison.OrdinalIgnoreCase)) continue;
        try {
          using(var file=Open(path,false,false,out info)) {
            if(ModifiedDate(info) > DateTime.UtcNow.AddDays(browser ? -1 : -7)) continue;
            long size=Size(info); if(size < 0 || size > 9007199254740991L) continue;
            group.files.Add(new PandoraFile {path=Full(path), root=root, categoryId=group.id, bytes=size, identity=Identity(info), modified=Modified(info)});
          }
        } catch(Exception ex) { warnings.Add(path + ": " + ex.Message); }
      }
    } catch(Exception ex) { warnings.Add(directory + ": " + ex.Message); }
    finally { if(handle != null) handle.Dispose(); if(parents != null) Release(parents); }
  }
  static string[] Profiles(string root) {
    if(!Directory.Exists(root)) return new string[0];
    List<SafeFileHandle> held=null; SafeFileHandle handle=null;
    try { held=LockParents(root); INFO info; handle=Open(root,true,false,out info); return Directory.GetDirectories(root); }
    finally { if(handle != null) handle.Dispose(); if(held != null) Release(held); }
  }
  static bool ChromiumProfile(string name) { int n; return name == "Default" || (name.StartsWith("Profile ") && Int32.TryParse(name.Substring(8),out n) && n > 0); }
  static bool Allowed(string kind, string root) {
    root=Full(root);
    if(kind == "safe") return root.Equals(Join(Local,"Temp"),StringComparison.OrdinalIgnoreCase) || root.Equals(Join(Windows,"Temp"),StringComparison.OrdinalIgnoreCase);
    if(kind != "browser") return false;
    foreach(string vendor in new[]{@"Google\Chrome\User Data",@"Microsoft\Edge\User Data"}) {
      string prefix=Join(Local,vendor) + "\\";
      if(root.StartsWith(prefix,StringComparison.OrdinalIgnoreCase)) {
        string[] parts=root.Substring(prefix.Length).Split('\\');
        if(parts.Length == 3 && ChromiumProfile(parts[0]) && parts[1] == "Cache" && parts[2] == "Cache_Data") return true;
      }
    }
    string firefox=Join(Local,@"Mozilla\Firefox\Profiles") + "\\";
    if(root.StartsWith(firefox,StringComparison.OrdinalIgnoreCase)) {
      string[] parts=root.Substring(firefox.Length).Split('\\');
      return parts.Length == 3 && parts[0].Length > 0 && parts[1] == "cache2" && parts[2] == "entries";
    }
    return false;
  }
  static BININFO QueryBin() {
    BININFO info=new BININFO(); info.cbSize=(uint)Marshal.SizeOf(typeof(BININFO));
    int result=SHQueryRecycleBin(null,ref info); if(result != 0) Marshal.ThrowExceptionForHR(result); return info;
  }
  public static PandoraScan Scan(string kind) {
    PandoraScan scan=new PandoraScan();
    if(kind == "safe") {
      AddGroup(scan,"user-temp","Unused temporary files","Only .tmp and .temp files unchanged for at least 7 days. Locked files and links are skipped.",Join(Local,"Temp"),false);
      AddGroup(scan,"windows-temp","Windows temporary files","Only stale .tmp and .temp files in Windows Temp. Protected or active files are skipped.",Join(Windows,"Temp"),false);
    } else if(kind == "browser") {
      foreach(string vendor in new[]{"Chrome","Edge"}) {
        string profileRoot=Join(Local,vendor == "Chrome" ? @"Google\Chrome\User Data" : @"Microsoft\Edge\User Data");
        try { foreach(string profile in Profiles(profileRoot)) if(ChromiumProfile(Path.GetFileName(profile))) AddGroup(scan,vendor.ToLowerInvariant()+"-cache",vendor+" cached images and files","Cache files at least 24 hours old. Close the browser first. Passwords, cookies, sessions, and browsing history are excluded.",Join(profile,@"Cache\Cache_Data"),true); }
        catch(Exception ex) { scan.warnings.Add(vendor+": "+ex.Message); }
      }
      try { foreach(string profile in Profiles(Join(Local,@"Mozilla\Firefox\Profiles"))) AddGroup(scan,"firefox-cache","Firefox cached images and files","Only cache2 entries at least 24 hours old; passwords, sessions, and history are excluded.",Join(profile,@"cache2\entries"),true); }
      catch(Exception ex) { scan.warnings.Add("Firefox: "+ex.Message); }
    } else if(kind == "recycle") {
      BININFO info=QueryBin();
      scan.groups.Add(new PandoraGroup {id="recycle-bin",title="Recycle Bin",description="Permanently empties ALL items currently in your Recycle Bin on all drives, including items added after this scan. Windows asks for separate confirmation. This can include personal files you previously deleted.",roots=new string[0],bytes=info.size,fileCount=info.count});
      scan.warnings.Add("Recycle Bin cleanup cannot be undone. Reported bytes are the observed before/after decrease in the bin, not a physical free-space measurement.");
    } else throw new ArgumentException("Unsupported cleanup kind.");
    scan.warnings.Add("Scan totals are exact logical sizes of eligible files at scan time. Changes, locks, compression, and other disk activity can affect the amount actually freed.");
    return scan;
  }
  public static PandoraOutcome Remove(string kind, string path, string root, long bytes, string identity, string modified) {
    var outcome=new PandoraOutcome {path=path,deleted=false,bytes=0}; List<SafeFileHandle> held=null;
    try {
      path=Full(path); root=Full(root);
      if(!Allowed(kind,root) || !path.StartsWith(root+"\\",StringComparison.OrdinalIgnoreCase)) throw new IOException("Path is outside an approved cleanup location.");
      if(kind == "safe") { string extension=Path.GetExtension(path); if(!extension.Equals(".tmp",StringComparison.OrdinalIgnoreCase) && !extension.Equals(".temp",StringComparison.OrdinalIgnoreCase)) throw new IOException("Not an approved temporary file."); }
      held=LockParents(path); INFO info;
      using(var handle=Open(path,false,true,out info)) {
        if(Identity(info) != identity || Modified(info) != modified || Size(info) != bytes) throw new IOException("File changed since scanning; rescan to inspect it again.");
        if(ModifiedDate(info) > DateTime.UtcNow.AddDays(kind == "browser" ? -1 : -7)) throw new IOException("File is too recent to clean safely.");
        DISPOSITION disposition=new DISPOSITION {DeleteFile=true};
        if(!SetFileInformationByHandle(handle,4,ref disposition,(uint)Marshal.SizeOf(typeof(DISPOSITION)))) throw new IOException("Windows refused deletion ("+Marshal.GetLastWin32Error()+").");
      }
      outcome.deleted=true; outcome.bytes=bytes;
    } catch(Exception ex) { outcome.reason=ex.Message; }
    finally { if(held != null) Release(held); }
    return outcome;
  }
  public static PandoraOutcome EmptyBin() {
    var result=new PandoraOutcome {path="Recycle Bin",deleted=false,bytes=0};
    try {
      BININFO before=QueryBin();
      // Retain the native confirmation: do NOT pass SHERB_NOCONFIRMATION (1).
      int hr=SHEmptyRecycleBin(IntPtr.Zero,null,4);
      BININFO after=QueryBin();
      result.bytes=Math.Max(0,before.size-after.size); result.deletedFiles=Math.Max(0,before.count-after.count); result.deleted=hr == 0;
      result.reason=(hr == 0 ? "Observed Recycle Bin size decrease; physical recovered space is unavailable." : "Windows canceled or could not complete Recycle Bin cleanup (HRESULT "+hr+").");
    } catch(Exception ex) { result.reason=ex.Message; }
    return result;
  }
}
'@
Add-Type -TypeDefinition $source
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
if ($request.operation -eq 'scan') {
  $scan = [PandoraCleaner]::Scan([string]$request.kind)
  @{ type='scan'; value=$scan } | ConvertTo-Json -Depth 9 -Compress
} elseif ($request.operation -eq 'clean' -and $request.kind -eq 'recycle') {
  @{ type='file'; value=[PandoraCleaner]::EmptyBin() } | ConvertTo-Json -Depth 5 -Compress
} elseif ($request.operation -eq 'clean') {
  foreach ($file in $request.files) {
    $result = [PandoraCleaner]::Remove([string]$request.kind,[string]$file.path,[string]$file.root,[long]$file.bytes,[string]$file.identity,[string]$file.modified)
    @{ type='file'; value=$result } | ConvertTo-Json -Depth 5 -Compress
  }
} else { throw 'Unsupported operation.' }
`;

export function createNativeCleanerAdapter(): CleanerAdapter {
  async function run(request: object, onEvent: (event: { type: string; value: unknown }) => void) {
    if (process.platform !== 'win32') throw new Error('PC Cleaner requires the Windows desktop app. No files were changed.');
    await new Promise<void>((resolve, reject) => {
      const executable = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', CLEANER_SCRIPT], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let pending = '', stderr = '', failed = false;
      const timer = setTimeout(() => { failed = true; child.kill(); reject(new Error('Cleaner timed out. Any files already processed remain deleted; rescan before retrying.')); }, 300_000);
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        pending += chunk;
        if (pending.length > 64 * 1024 * 1024) { failed = true; child.kill(); reject(new Error('Cleaner output exceeded the safe limit.')); return; }
        let newline: number;
        while ((newline = pending.indexOf('\n')) >= 0) {
          const line = pending.slice(0, newline).trim(); pending = pending.slice(newline + 1);
          if (!line) continue;
          try { onEvent(JSON.parse(line)); } catch (error) { failed = true; child.kill(); reject(error); }
        }
      });
      child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-12000); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); if (failed) return; if (code === 0) resolve(); else reject(new Error(`Windows cleaner failed: ${stderr.trim() || `exit ${code}`}`)); });
      child.stdin.on('error', () => { /* exit/error handler supplies the actionable error */ });
      child.stdin.end(JSON.stringify(request));
    });
  }
  return {
    async scan(kind) {
      let scan: NativeScan | undefined;
      await run({ operation: 'scan', kind }, event => { if (event.type === 'scan') scan = event.value as NativeScan; });
      if (!scan) throw new Error('Windows did not return scan results.');
      return scan;
    },
    async remove(kind, files, onFile) { await run({ operation: 'clean', kind, files }, event => { if (event.type === 'file') onFile(event.value as FileOutcome); }); },
  };
}
