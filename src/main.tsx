import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { loadPersisted, startPersistence } from './db/persist';
import { initInstallPrompt } from './pwa/installPrompt';
import { registerServiceWorker } from './pwa/registerSW';
import { useStore } from './store';
import { App } from './ui/App';

async function start(): Promise<void> {
  initInstallPrompt();
  registerServiceWorker();

  const persisted = await loadPersisted();
  useStore.getState().hydrate(persisted);
  startPersistence(useStore);

  // Deterministic handle for the Playwright smoke test.
  if (new URLSearchParams(location.search).has('e2e')) {
    (window as unknown as Record<string, unknown>).__sudoku = { store: useStore };
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
