/** A deliberately small inventory, not an uninstall or system-package allowlist. */
export const OPTIONAL_APPS = [
  { id: 'clipchamp', name: 'Clipchamp', packageName: 'Clipchamp.Clipchamp', publisherId: 'yxz26nhyzhsrt', purpose: 'Video editing', caution: 'Back up local video projects and original media before uninstalling.' },
  { id: 'solitaire', name: 'Microsoft Solitaire Collection', packageName: 'Microsoft.MicrosoftSolitaireCollection', publisherId: '8wekyb3d8bbwe', purpose: 'Casual games', caution: 'Check your game progress and account synchronization before uninstalling.' },
  { id: 'news', name: 'Microsoft News', packageName: 'Microsoft.BingNews', publisherId: '8wekyb3d8bbwe', purpose: 'News reader', caution: 'Saved preferences may be removed. This package is separate from the Windows Widgets platform.' },
  { id: 'weather', name: 'MSN Weather', packageName: 'Microsoft.BingWeather', publisherId: '8wekyb3d8bbwe', purpose: 'Weather forecasts', caution: 'Saved locations and preferences may be removed. Removing the app does not disable Widgets.' },
  { id: 'feedback', name: 'Feedback Hub', packageName: 'Microsoft.WindowsFeedbackHub', publisherId: '8wekyb3d8bbwe', purpose: 'Windows feedback', caution: 'Keep this app if you report Windows issues or participate in Windows Insider feedback.' },
  { id: 'recorder', name: 'Sound Recorder', packageName: 'Microsoft.WindowsSoundRecorder', publisherId: '8wekyb3d8bbwe', purpose: 'Audio recording', caution: 'Export and verify your recordings before uninstalling. PANDORA does not back up app data.' },
  { id: 'office-hub', name: 'Microsoft 365 companion', packageName: 'Microsoft.MicrosoftOfficeHub', publisherId: '8wekyb3d8bbwe', purpose: 'Microsoft 365 launch hub', caution: 'The companion may appear as Microsoft 365 Copilot. It is separate from installed Word, Excel, and their documents.' },
  { id: 'todo', name: 'Microsoft To Do', packageName: 'Microsoft.Todos', publisherId: '8wekyb3d8bbwe', purpose: 'Tasks and reminders', caution: 'Verify that your tasks are synchronized or exported before uninstalling.' },
] as const;
export type OptionalAppId = typeof OPTIONAL_APPS[number]['id'];
export interface OptionalAppPackage { version: string; architecture: string; protected: boolean; status: string; }
export interface OptionalAppState {
  id: OptionalAppId; state: 'installed' | 'not-installed' | 'unavailable';
  packages: OptionalAppPackage[]; reason: string | null;
}
export interface OptionalAppsInfo { supported: boolean; timestamp: string; entries: OptionalAppState[]; complete: boolean; }
