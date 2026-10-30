export interface ProcessIdentity {
  pid: number; name: string; startedAt: string | null;
  executable: string | null; company: string | null; version: string | null;
}
export interface ProcessDetails extends ProcessIdentity { token: string | null; }
