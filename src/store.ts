import { load, type Store } from "@tauri-apps/plugin-store";

// Persisted app settings live in a single small JSON file managed by
// tauri-plugin-store. Right now the only thing we remember is the last folder.
const STORE_FILE = "folyx.json";
const LAST_FOLDER_KEY = "last_folder";

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
