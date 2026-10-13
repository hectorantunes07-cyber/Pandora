import type { SystemInfo } from './types';
export function graphicsGuidance(system: SystemInfo | null) {
  if (!system || system.platform !== 'win32' || !system.gpu) return null;
  const gpu = system.gpu;
  const vendor = /nvidia|geforce|quadro/i.test(gpu) ? 'NVIDIA' : /\bamd\b|radeon/i.test(gpu) ? 'AMD' : /\bintel\b/i.test(gpu) ? 'Intel' : 'Unknown';
  const advice = vendor === 'NVIDIA'
    ? 'In games that expose NVIDIA Reflex for this GPU, compare Off and On in the same scene. Review Boost separately because it can increase power use. Keep global driver settings unchanged while testing.'
    : vendor === 'AMD'
      ? 'Use Radeon Anti-Lag only when your driver exposes support for this game. Use Anti-Lag 2 only through an officially supported in-game option. Compare frame times before keeping the change.'
      : vendor === 'Intel'
        ? 'Use the graphics options exposed by your installed Intel driver and game. Compare one setting at a time; available features depend on the GPU and driver.'
        : 'Review options exposed by your installed graphics driver. GPU feature support could not be established from this inventory.';
  return { vendor, gpu, driver: system.gpuDriver, advice,
    driverUrl: vendor === 'NVIDIA' ? 'https://www.nvidia.com/en-us/drivers/' : vendor === 'AMD' ? 'https://www.amd.com/en/support' : null };
}
export function refreshBudget(hz: number | null): string | null {
  return hz !== null && Number.isFinite(hz) && hz > 0 ? (1000 / hz).toFixed(2) : null;
}
