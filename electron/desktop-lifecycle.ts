interface Event { preventDefault(): void; }
interface WindowPort { isMinimized(): boolean; restore(): void; show(): void; focus(): void; hide(): void; }
export function createDesktopLifecycle(ports: { window(): WindowPort | null; createTray(show: () => void, quit: () => void): { destroy(): void }; busy(): boolean; notifyBusy(): void; quit(): void }) {
  let tray: { destroy(): void } | null = null, enabled = false, quitting = false;
  const show = () => { const window = ports.window(); if (!window) return; if (window.isMinimized()) window.restore(); window.show(); window.focus(); };
  const requestQuit = () => { if (ports.busy()) { show(); ports.notifyBusy(); return; } ports.quit(); };
  return {
    show, requestQuit,
    get enabled() { return enabled; },
    configure(value: boolean) {
      if (value && !tray) tray = ports.createTray(show, requestQuit);
      enabled = value;
      if (!value && tray) { show(); tray.destroy(); tray = null; }
    },
    close(event: Event) {
      if (ports.busy()) { event.preventDefault(); quitting = false; ports.notifyBusy(); return; }
      if (!quitting && enabled && tray) { event.preventDefault(); ports.window()?.hide(); }
    },
    beforeQuit(event: Event) {
      if (ports.busy()) { event.preventDefault(); quitting = false; show(); ports.notifyBusy(); }
      else quitting = true;
    },
    dispose() { tray?.destroy(); tray = null; enabled = false; },
  };
}
