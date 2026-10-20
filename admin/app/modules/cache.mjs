const DB_NAME = "mbw-mobile-phase1";
const STORE = "snapshots";
const MAX_AGE = 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "identity" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, work) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), store = tx.objectStore(STORE);
      work(store, resolve, reject);
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function saveSnapshot(identity, data) {
  if (!identity) return;
  await transaction("readwrite", (store, resolve, reject) => {
    const request = store.put({ identity, savedAt: Date.now(), data });
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshot(identity) {
  if (!identity) return null;
  const entry = await transaction("readonly", (store, resolve, reject) => {
    const request = store.get(identity); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error);
  });
  if (!entry || Date.now() - entry.savedAt > MAX_AGE) return null;
  return entry;
}

export async function clearSnapshot(identity) {
  if (!identity) return;
  await transaction("readwrite", (store, resolve, reject) => {
    const request = store.delete(identity); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}

export async function clearSnapshots() {
  await transaction("readwrite", (store, resolve, reject) => {
    const request = store.clear(); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}
