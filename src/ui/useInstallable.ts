import { useSyncExternalStore } from 'react';
import { subscribeInstallable } from '../pwa/installPrompt';

let installable = false;

const subscribe = (onStoreChange: () => void) =>
  subscribeInstallable((available) => {
    installable = available;
    onStoreChange();
  });

export function useInstallable(): boolean {
  return useSyncExternalStore(subscribe, () => installable);
}
