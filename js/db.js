'use strict';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date', { unique: false });
      }
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror   = e => rej(e.target.error);
  });
}

function dbAdd(r) {
  return openDB().then(db => new Promise((res, rej) => {
    const q = db.transaction(STORE, 'readwrite').objectStore(STORE).add(r);
    q.onsuccess = e => res(e.target.result);
    q.onerror   = e => rej(e.target.error);
  }));
}

function dbGetByDate(date) {
  return openDB().then(db => new Promise((res, rej) => {
    const q = db.transaction(STORE, 'readonly')
                .objectStore(STORE)
                .index('date')
                .getAll(IDBKeyRange.only(date));
    q.onsuccess = e => res(e.target.result);
    q.onerror   = e => rej(e.target.error);
  }));
}

function dbGetById(id) {
  return openDB().then(db => new Promise((res, rej) => {
    const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    q.onsuccess = e => res(e.target.result);
    q.onerror   = e => rej(e.target.error);
  }));
}

function dbPut(r) {
  return openDB().then(db => new Promise((res, rej) => {
    const q = db.transaction(STORE, 'readwrite').objectStore(STORE).put(r);
    q.onsuccess = () => res();
    q.onerror   = e => rej(e.target.error);
  }));
}

function dbDel(id) {
  return openDB().then(db => new Promise((res, rej) => {
    const q = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    q.onsuccess = () => res();
    q.onerror   = e => rej(e.target.error);
  }));
}

function dbGetAll() {
  return openDB().then(db => new Promise((res, rej) => {
    const q = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    q.onsuccess = e => res(e.target.result);
    q.onerror   = e => rej(e.target.error);
  }));
}
