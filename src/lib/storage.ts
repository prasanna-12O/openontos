/**
 * Storage adapter for OpenOntos persistence.
 * 
 * - In Electron: uses IPC to save/load from a local JSON file in userData dir
 * - In Browser: uses localForage (IndexedDB under the hood) for ~100x more
 *   capacity than localStorage (~50 MB+ vs ~5 MB).
 * 
 * The Electron path is wired through electron/preload.cjs → electron/main.cjs
 * which reads/writes openontos-data.json in the system's app data folder.
 */

import localforage from 'localforage';

// Configure the localForage instance
localforage.config({
  name: 'openontos',
  storeName: 'app_state',
  description: 'OpenOntos application state',
});

interface ElectronDB {
  load: () => Promise<unknown>;
  save: (data: unknown) => Promise<boolean>;
  getDbPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronDB?: ElectronDB;
  }
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!window.electronDB;
};

/**
 * Creates a Storage-compatible object that routes to Electron's
 * local file system when available, or uses localForage (IndexedDB)
 * in the browser for large-capacity persistent storage.
 */
export const createElectronStorage = () => ({
  getItem: async (name: string): Promise<string | null> => {
    if (isElectron()) {
      const data = await window.electronDB!.load();
      return data ? JSON.stringify(data) : null;
    }
    // localForage returns null if key doesn't exist
    const value = await localforage.getItem<string>(name);
    // Migration: if IndexedDB is empty, check localStorage for existing data
    if (value === null) {
      const legacyValue = localStorage.getItem(name);
      if (legacyValue) {
        // Migrate to IndexedDB and clean up localStorage
        await localforage.setItem(name, legacyValue);
        localStorage.removeItem(name);
        return legacyValue;
      }
    }
    return value;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (isElectron()) {
      await window.electronDB!.save(JSON.parse(value));
    }
    await localforage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (isElectron()) {
      await window.electronDB!.save(null);
    }
    await localforage.removeItem(name);
  },
});