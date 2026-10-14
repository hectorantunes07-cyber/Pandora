import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { POWER_CONTROLS } from '../shared/power-tuning';
export const validPowerGuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
export const POWER_TUNING_NATIVE_SOURCE = `
using System;
using System.Runtime.InteropServices;
public static class PandoraPowerTuning {
 [DllImport("powrprof.dll")] static extern uint PowerGetActiveScheme(IntPtr root,out IntPtr scheme);
 [DllImport("powrprof.dll")] static extern uint PowerReadACValueIndex(IntPtr root,ref Guid scheme,ref Guid subgroup,ref Guid setting,out uint value);
 [DllImport("powrprof.dll")] static extern uint PowerWriteACValueIndex(IntPtr root,ref Guid scheme,ref Guid subgroup,ref Guid setting,uint value);
 [DllImport("powrprof.dll")] static extern uint PowerSetActiveScheme(IntPtr root,ref Guid scheme);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
 static readonly Guid[] Groups = new Guid[]{${POWER_CONTROLS.map(c => `new Guid("${c.subgroup}")`).join(',')}};
 static readonly Guid[] Settings = new Guid[]{${POWER_CONTROLS.map(c => `new Guid("${c.setting}")`).join(',')}};
 static readonly uint[] Maximum = new uint[]{${POWER_CONTROLS.map(c => c.maximum).join(',')}};
 public class Snapshot { public string planId; public string activePlanId; public uint?[] values; }
 static void Check(uint error,string operation) { if(error!=0) throw new System.ComponentModel.Win32Exception((int)error,operation); }
 public static Guid Active() { IntPtr p; Check(PowerGetActiveScheme(IntPtr.Zero,out p),"Read active power plan"); try { return (Guid)Marshal.PtrToStructure(p,typeof(Guid)); } finally {LocalFree(p);} }
 static uint Value(Guid plan,int i) {uint v; Check(PowerReadACValueIndex(IntPtr.Zero,ref plan,ref Groups[i],ref Settings[i],out v),"Read AC policy"); return v;}
 public static Snapshot Read(string requested) {
  var active=Active(); var plan=String.IsNullOrEmpty(requested)?active:new Guid(requested); var values=new uint?[Settings.Length];
  for(int i=0;i<Settings.Length;i++) {try { uint v=Value(plan,i); if(v<=Maximum[i]) values[i]=v; } catch {values[i]=null;} }
  return new Snapshot{planId=plan.ToString(),activePlanId=active.ToString(),values=values};
 }
 public static void Write(string planText,string activeText,int i,uint expected,uint desired) {
  if(i<0 || i>=Settings.Length || desired>Maximum[i]) throw new ArgumentException("Invalid power control.");
  var plan=new Guid(planText); var active=new Guid(activeText);
  if(Active()!=active || Value(plan,i)!=expected) throw new Exception("Power policy changed after review.");
  if(i==0 && desired>Value(plan,1) || i==1 && desired<Value(plan,0)) throw new Exception("Processor minimum must not exceed maximum.");
  Check(PowerWriteACValueIndex(IntPtr.Zero,ref plan,ref Groups[i],ref Settings[i],desired),"Write AC policy");
  if(Active()!=active) throw new Exception("Active power plan changed; the saved setting was not activated.");
  if(plan==active) Check(PowerSetActiveScheme(IntPtr.Zero,ref plan),"Refresh active power plan");
  if(Value(plan,i)!=desired || Active()!=active) throw new Exception("Power policy verification failed.");
 }
}`;
export interface PowerTuningSnapshot { planId: string; activePlanId: string; values: Record<string, number | null>; }
export interface PowerTuningAdapter { supported: boolean; read(planId?: string): Promise<PowerTuningSnapshot>; write(planId: string, activePlanId: string, id: string, expected: number, desired: number): Promise<void>; }
export function createWindowsPowerTuningAdapter(): PowerTuningAdapter {
  const supported = process.platform === 'win32';
  async function run(command: string) {
    if (!supported) throw new Error('Advanced power controls require Windows.');
    const script = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${POWER_TUNING_NATIVE_SOURCE}\n'@\n${command}`;
    const { stdout } = await promisify(execFile)(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 20_000, maxBuffer: 16_000 }); return stdout.replace(/^\uFEFF/, '').trim();
  }
  return { supported, async read(planId) {
    if (planId !== undefined && !validPowerGuid(planId)) throw new Error('Invalid plan.');
    const raw = JSON.parse(await run(`[PandoraPowerTuning]::Read('${planId ?? ''}') | ConvertTo-Json -Compress`));
    if (!validPowerGuid(raw?.planId) || !validPowerGuid(raw?.activePlanId) || !Array.isArray(raw.values) || raw.values.length !== POWER_CONTROLS.length || raw.values.some((v: unknown, i: number) => v !== null && (!Number.isInteger(v) || (v as number) < 0 || (v as number) > POWER_CONTROLS[i].maximum))) throw new Error('Invalid power-policy response.');
    return { planId: raw.planId, activePlanId: raw.activePlanId, values: Object.fromEntries(POWER_CONTROLS.map((c, i) => [c.id, raw.values[i]])) };
  }, async write(planId, activePlanId, id, expected, desired) {
    const index = POWER_CONTROLS.findIndex(c => c.id === id);
    if (!validPowerGuid(planId) || !validPowerGuid(activePlanId) || index < 0 || ![expected, desired].every(v => Number.isInteger(v) && v >= 0 && v <= POWER_CONTROLS[index].maximum)) throw new Error('Invalid power-policy request.');
    await run(`[PandoraPowerTuning]::Write('${planId}','${activePlanId}',${index},${expected},${desired})`);
  } };
}
