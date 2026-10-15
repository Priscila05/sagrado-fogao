/**
 * Registers the service worker that keeps the application openable offline.
 * Only in production builds served over http(s) — never during development.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!['http:', 'https:'].includes(window.location.protocol)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Offline support is an enhancement: failing to register is not fatal.
      console.warn('[alinho] service worker não registrado', error);
    });
  });
}
