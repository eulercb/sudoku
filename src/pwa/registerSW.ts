import { registerSW } from 'virtual:pwa-register';

/** Auto-updating service worker; the app shell works offline after first load. */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return;
  registerSW({ immediate: true });
}
