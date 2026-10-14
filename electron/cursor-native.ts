import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { CursorValue } from '../shared/types';
export const CURSOR_NATIVE_SOURCE = String.raw`
using System;
using Microsoft.Win32;
using System.Runtime.InteropServices;
public static class PandoraCursor {
 public class Value { public string kind; public string value; }
 [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr LoadCursorFromFile(string path);
 [DllImport("user32.dll", EntryPoint="LoadCursorW")] static extern IntPtr LoadCursor(IntPtr instance, IntPtr name);
 [DllImport("user32.dll")] public static extern IntPtr CopyIcon(IntPtr icon);
 [DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr icon);
 [DllImport("user32.dll")] static extern bool DestroyCursor(IntPtr cursor);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern uint GetDriveType(string root);
 [DllImport("user32.dll", EntryPoint="SystemParametersInfoW", SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] static extern bool Spi(uint action,uint parameter,IntPtr value,uint flags);
 public static IntPtr CopyArrow() { var arrow=LoadCursor(IntPtr.Zero,new IntPtr(32512)); if(arrow==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(); var copy=CopyIcon(arrow); if(copy==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(); return copy; }
 public static Value Read() {
  using(var key=Registry.CurrentUser.OpenSubKey(@"Control Panel\Cursors",false)) {
   if(key==null || Array.IndexOf(key.GetValueNames(),"Arrow")<0) return new Value();
   var kind=key.GetValueKind("Arrow"); if(kind!=RegistryValueKind.String && kind!=RegistryValueKind.ExpandString) throw new Exception("Unsupported Arrow registry type.");
   return new Value{kind=kind.ToString(),value=(string)key.GetValue("Arrow",null,RegistryValueOptions.DoNotExpandEnvironmentNames)};
  }
 }
 static bool Same(Value a,Value b) { return a.kind==b.kind && a.value==b.value; }
 static void Validate(Value v) {
  if(v.kind==null && v.value==null) return;
  if((v.kind!="String" && v.kind!="ExpandString") || v.value==null || v.value.Length>32767) throw new Exception("Invalid Arrow value.");
  if(v.value.Length==0) return;
  string p=v.kind=="ExpandString" ? Environment.ExpandEnvironmentVariables(v.value) : v.value;
  if(p.Length<3 || !Char.IsLetter(p[0]) || p[1]!=':' || p[2]!='\\') throw new Exception("Only local cursor paths can be restored.");
  var root=System.IO.Path.GetPathRoot(p); uint drive=GetDriveType(root); if(drive!=2 && drive!=3) throw new Exception("Only local drives are supported.");
  var cursor=LoadCursorFromFile(p); if(cursor==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(); DestroyCursor(cursor);
 }
 public static void Write(object expectedKind,object expectedValue,object desiredKind,object desiredValue,bool restoring) {
  var expected=new Value{kind=expectedKind as string,value=expectedValue as string}; var desired=new Value{kind=desiredKind as string,value=desiredValue as string};
  if(!restoring) Validate(expected); Validate(desired);
  using(var key=Registry.CurrentUser.OpenSubKey(@"Control Panel\Cursors",true)) {
   if(key==null) throw new Exception("Windows cursor configuration is unavailable.");
   if(!Same(Read(),expected)) throw new Exception("Arrow changed after review; no value was overwritten.");
   if(desired.kind==null) key.DeleteValue("Arrow",false);
   else key.SetValue("Arrow",desired.value,desired.kind=="String"?RegistryValueKind.String:RegistryValueKind.ExpandString);
   key.Flush();
  }
  // Reload configured cursors; only Arrow was changed. Other registry roles remain intact.
  if(!Spi(0x0057,0,IntPtr.Zero,3)) throw new System.ComponentModel.Win32Exception();
  if(!Same(Read(),desired)) throw new Exception("Arrow read-back mismatch.");
 }
}`;
export function validCursorValue(v: unknown): v is CursorValue {
  if (!v || typeof v !== 'object') return false; const value = v as CursorValue;
  return value.kind === null && value.value === null || ['String', 'ExpandString'].includes(value.kind as string) && typeof value.value === 'string' && value.value.length <= 32767 && !value.value.includes('\0');
}
export interface CursorAdapter { supported: boolean; read(): Promise<CursorValue>; write(expected: CursorValue, desired: CursorValue, restore: boolean): Promise<void>; preview(): Promise<string | null>; }
export function createWindowsCursorAdapter(): CursorAdapter {
  const supported = process.platform === 'win32';
  async function run(command: string) {
    if (!supported) throw new Error('Cursor customization requires Windows.');
    const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${CURSOR_NATIVE_SOURCE}\n'@\n${command}`;
    const { stdout } = await promisify(execFile)(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024 });
    return stdout.replace(/^\uFEFF/, '').trim();
  }
  return {
    supported,
    async read() { const value: unknown = JSON.parse(await run('[PandoraCursor]::Read() | ConvertTo-Json -Compress')); if (!validCursorValue(value)) throw new Error('Windows returned an unsupported cursor value.'); return value; },
    async write(expected, desired, restore) {
      if (!validCursorValue(expected) || !validCursorValue(desired)) throw new Error('Invalid cursor request.');
      // JSON is encoded as data; file names never become executable PowerShell syntax.
      const payload = Buffer.from(JSON.stringify({ expected, desired }), 'utf8').toString('base64');
      await run(`$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json; [PandoraCursor]::Write($v.expected.kind,$v.expected.value,$v.desired.kind,$v.desired.value,${restore ? '$true' : '$false'})`);
    },
    async preview() {
      try {
        const png = await run(`Add-Type -AssemblyName System.Drawing; $h=[PandoraCursor]::CopyArrow(); try { $icon=[Drawing.Icon]::FromHandle($h); try { $bitmap=$icon.ToBitmap(); try { $stream=New-Object IO.MemoryStream; try { $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png); [Convert]::ToBase64String($stream.ToArray()) } finally { $stream.Dispose() } } finally { $bitmap.Dispose() } } finally { $icon.Dispose() } } finally { [void][PandoraCursor]::DestroyIcon($h) }`);
        return /^[A-Za-z0-9+/=]+$/.test(png) && png.length < 500_000 ? `data:image/png;base64,${png}` : null;
      } catch { return null; }
    },
  };
}
