/**
 * Captures `beforeinstallprompt` so the app can offer a tasteful install
 * affordance instead of the browser's banner.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

const notify = () => {
  for (const listener of listeners) listener(deferred !== null);
};

export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function subscribeInstallable(listener: (available: boolean) => void): () => void {
  listeners.add(listener);
  listener(deferred !== null);
  return () => listeners.delete(listener);
}

export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null;
  notify();
  await event.prompt();
  await event.userChoice;
}
