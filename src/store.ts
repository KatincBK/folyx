import { load, type Store } from "@tauri-apps/plugin-store";

// Persisted app settings live in a single small JSON file managed by
// tauri-plugin-store. Right now the only thing we remember is the last folder.
const STORE_FILE = "folyx.json";
const LAST_FOLDER_KEY = "last_folder";
const FAVORITES_KEY = "favorites";

let storePromise: Promise<Store> | null = null;

/** Lazily open (and cache) the single store instance. */
function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE);
  }
  return storePromise;
}

/** The last folder the user opened, or null if none has been saved yet. */
export async function getLastFolder(): Promise<string | null> {
  const store = await getStore();
  return (await store.get<string>(LAST_FOLDER_KEY)) ?? null;
}

/** Remember the folder the user just opened so we can auto-restore it next launch. */
export async function setLastFolder(path: string): Promise<void> {
  const store = await getStore();
  await store.set(LAST_FOLDER_KEY, path);
  await store.save();
}

/** Absolute paths the user has starred. Persisted globally (not per-folder) so a
 *  favorite survives re-scans and reopening the app. */
export async function getFavorites(): Promise<string[]> {
  const store = await getStore();
  const list = await store.get<string[]>(FAVORITES_KEY);
  return Array.isArray(list) ? list : [];
}

/** Persist the full set of starred paths. */
export async function setFavorites(paths: string[]): Promise<void> {
  const store = await getStore();
  await store.set(FAVORITES_KEY, paths);
  await store.save();
}
