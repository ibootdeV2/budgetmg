// ============================================================================
// services/storage.js
// Phase 1 : Fondations données — couche de stockage OFFLINE (localStorage)
// ============================================================================
// Rôle de ce fichier :
//   - Définir la structure centrale des données de l'app (DB).
//   - Gérer le versionnement du schéma local + migrations automatiques.
//   - Fournir des fonctions CRUD génériques et centralisées pour toutes les
//     "tables" (transactions, budget, goals), réutilisées par les hooks
//     (useTransactions, useBudget, ...) construits dans les phases suivantes.
//
// Chaque enregistrement a une forme "sync-ready" (même si la synchro Supabase
// arrive en phase 3), pour éviter une nouvelle migration de schéma plus tard :
//   { id, ...champs métier, created_at, updated_at, deleted_at, dirty }
//
//   - id          : identifiant stable (uuid), généré côté client.
//   - deleted_at  : soft delete ("tombstone"). On ne supprime jamais une ligne
//                   directement : ça permet, plus tard, de propager la
//                   suppression vers Supabase même si elle a eu lieu hors-ligne.
//   - dirty       : true si la ligne a une modification locale pas encore
//                   envoyée au cloud. Utilisé par la file de synchro (phase 3).
// ============================================================================

const STORAGE_KEY = "budget-mga:db";
const CURRENT_SCHEMA_VERSION = 1;

/** Nom des "tables" gérées par l'app. */
export const TABLES = Object.freeze({
  TRANSACTIONS: "transactions",
  BUDGET_LINES: "budget",
  SAVINGS_GOALS: "goals",
});

// ----------------------------------------------------------------------------
// Structure par défaut de la base locale
// ----------------------------------------------------------------------------
function defaultDB() {
  return {
    version: CURRENT_SCHEMA_VERSION,
    transactions: [],
    budget: [],
    goals: [],
    // Métadonnées globales, utiles dès la phase 3 (sync) :
    _meta: {
      userId: null, // rempli après connexion (phase 2)
      lastSyncedAt: null,
    },
  };
}

// ----------------------------------------------------------------------------
// Migrations : chaque entrée migre la DB de la version (N) vers (N+1).
// Ajouter une nouvelle fonction ici à chaque évolution du schéma local, sans
// jamais modifier les migrations déjà publiées.
// ----------------------------------------------------------------------------
const migrations = {
  // Exemple pour une future v2 :
  // 1: (db) => ({ ...db, version: 2, budget: db.budget.map(b => ({ ...b, year: b.year ?? new Date().getFullYear() })) }),
};

function runMigrations(db) {
  let current = db;
  while (current.version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[current.version];
    if (!migrate) break; // pas de migration définie : on s'arrête pour éviter une boucle infinie
    current = migrate(current);
  }
  return current;
}

// ----------------------------------------------------------------------------
// Lecture / écriture bas niveau
// ----------------------------------------------------------------------------
function loadDB() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage indisponible (mode privé strict, quota, etc.)
    return defaultDB();
  }

  if (!raw) {
    const fresh = defaultDB();
    persistDB(fresh);
    return fresh;
  }

  try {
    const parsed = JSON.parse(raw);
    const migrated = runMigrations(parsed);
    if (migrated.version !== parsed.version) persistDB(migrated);
    return migrated;
  } catch {
    // JSON corrompu : on ne perd pas la main, on repart d'une base saine
    console.error("[storage] DB locale corrompue, réinitialisation.");
    const fresh = defaultDB();
    persistDB(fresh);
    return fresh;
  }
}

function persistDB(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (err) {
    console.error("[storage] Échec d'écriture localStorage :", err);
    return false;
  }
}

// DB tenue en mémoire pendant la session pour éviter de re-parser à chaque appel.
let dbCache = null;
function getDB() {
  if (!dbCache) dbCache = loadDB();
  return dbCache;
}
function setDB(next) {
  dbCache = next;
  persistDB(next);
  return next;
}

// ----------------------------------------------------------------------------
// Utilitaires
// ----------------------------------------------------------------------------
export function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowISO() {
  return new Date().toISOString();
}

// ----------------------------------------------------------------------------
// Événements légers : permettent aux hooks React de se re-rendre quand la DB
// locale change, sans passer par un state manager global.
//   - "storage:changed" : une mutation LOCALE a eu lieu (create/update/remove).
//                          useOfflineSync.jsx écoute cet événement pour
//                          déclencher une synchro (debounce).
//   - "storage:synced"  : une donnée est arrivée du CLOUD (pull) et a été
//                          fusionnée. Les hooks l'écoutent pour rafraîchir
//                          l'UI, sans redéclencher de synchro.
// ----------------------------------------------------------------------------
function emit(eventName, table) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(eventName, { detail: { table } }));
  }
}

function applyFilter(records, filter) {
  if (!filter) return records;
  return records.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v));
}

function applySort(records, sort) {
  if (!sort) return records;
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return [...records].sort((a, b) => {
    if (a[field] === b[field]) return 0;
    const cmp = a[field] > b[field] ? 1 : -1;
    return desc ? -cmp : cmp;
  });
}

// ----------------------------------------------------------------------------
// CRUD centralisé, générique à toutes les tables
// ----------------------------------------------------------------------------

/**
 * Liste les enregistrements d'une table.
 * @param {string} table - une valeur de TABLES
 * @param {object} [options]
 * @param {object} [options.filter] - égalité exacte sur des champs, ex. { month: 6 }
 * @param {string} [options.sort] - champ à trier, préfixe "-" pour desc, ex. "-date"
 * @param {number} [options.limit]
 * @param {boolean} [options.includeDeleted=false] - inclure les lignes soft-deleted
 */
export function list(table, { filter, sort, limit, includeDeleted = false } = {}) {
  const db = getDB();
  let records = db[table] || [];
  if (!includeDeleted) records = records.filter((r) => !r.deleted_at);
  records = applyFilter(records, filter);
  records = applySort(records, sort);
  if (limit) records = records.slice(0, limit);
  return records;
}

export function get(table, id) {
  const db = getDB();
  return (db[table] || []).find((r) => r.id === id) || null;
}

export function create(table, data) {
  const db = getDB();
  const record = {
    id: generateId(),
    ...data,
    created_at: nowISO(),
    updated_at: nowISO(),
    deleted_at: null,
    dirty: true, // à synchroniser (phase 3)
    synced_at: null, // jamais encore envoyé au cloud (voir services/sync.js)
  };
  const next = { ...db, [table]: [...(db[table] || []), record] };
  setDB(next);
  emit("storage:changed", table);
  return record;
}

/**
 * Crée plusieurs enregistrements en une seule écriture localStorage (plus
 * efficace qu'un create() par ligne pour un import en masse). Chaque ligne
 * suit la même forme "sync-ready" que create().
 */
export function bulkCreate(table, dataList) {
  const db = getDB();
  const now = nowISO();
  const records = dataList.map((data) => ({
    id: generateId(),
    ...data,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    dirty: true,
    synced_at: null,
  }));
  const next = { ...db, [table]: [...(db[table] || []), ...records] };
  setDB(next);
  emit("storage:changed", table);
  return records;
}

export function update(table, id, patch) {
  const db = getDB();
  const records = db[table] || [];
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`[storage] ${table} ${id} introuvable`);

  const updated = { ...records[idx], ...patch, updated_at: nowISO(), dirty: true };
  const nextRecords = [...records];
  nextRecords[idx] = updated;
  setDB({ ...db, [table]: nextRecords });
  emit("storage:changed", table);
  return updated;
}

/**
 * Supprime un enregistrement. Soft delete par défaut (recommandé, prépare la
 * synchro cloud) : la ligne reste en base locale avec `deleted_at` renseigné
 * et n'apparaît plus dans `list()` tant que includeDeleted n'est pas demandé.
 */
export function remove(table, id, { soft = true } = {}) {
  const db = getDB();
  const records = db[table] || [];

  if (!soft) {
    setDB({ ...db, [table]: records.filter((r) => r.id !== id) });
    emit("storage:changed", table);
    return { id };
  }

  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return { id };
  const nextRecords = [...records];
  nextRecords[idx] = { ...records[idx], deleted_at: nowISO(), dirty: true };
  setDB({ ...db, [table]: nextRecords });
  emit("storage:changed", table);
  return { id };
}

/**
 * Supprime plusieurs enregistrements en une seule écriture localStorage
 * (miroir de bulkCreate) — utile pour une suppression multiple depuis
 * l'interface, plutôt que N appels remove() séparés.
 */
export function bulkRemove(table, ids, { soft = true } = {}) {
  const db = getDB();
  const idSet = new Set(ids);
  const records = db[table] || [];

  if (!soft) {
    setDB({ ...db, [table]: records.filter((r) => !idSet.has(r.id)) });
    emit("storage:changed", table);
    return { ids: [...idSet] };
  }

  const now = nowISO();
  const nextRecords = records.map((r) => (idSet.has(r.id) ? { ...r, deleted_at: now, dirty: true } : r));
  setDB({ ...db, [table]: nextRecords });
  emit("storage:changed", table);
  return { ids: [...idSet] };
}

/** Purge définitivement les lignes soft-deleted déjà synchronisées (à utiliser depuis sync.js, phase 3). */
export function purgeDeleted(table, ids) {
  const db = getDB();
  const idSet = new Set(ids);
  const nextRecords = (db[table] || []).filter((r) => !idSet.has(r.id));
  setDB({ ...db, [table]: nextRecords });
}

// ----------------------------------------------------------------------------
// Fonctions dédiées à la synchronisation (services/sync.js, phase 3)
// ----------------------------------------------------------------------------

/**
 * Marque un enregistrement local comme synchronisé, SANS le remettre `dirty`
 * (contrairement à update()). À appeler juste après un push cloud réussi.
 */
export function markSynced(table, id, syncedAt) {
  const db = getDB();
  const records = db[table] || [];
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const nextRecords = [...records];
  nextRecords[idx] = { ...records[idx], dirty: false, synced_at: syncedAt };
  setDB({ ...db, [table]: nextRecords });
  return nextRecords[idx];
}

/**
 * Intègre un enregistrement venu du cloud (autre appareil / autre session)
 * dans la base locale, en respectant la règle : "priorité aux données locales
 * non encore synchronisées". Sinon, on applique un last-write-wins simple
 * basé sur `updated_at`.
 */
export function mergeRemote(table, remoteRecord) {
  const db = getDB();
  const records = db[table] || [];
  const idx = records.findIndex((r) => r.id === remoteRecord.id);

  if (idx === -1) {
    const next = [
      ...records,
      { ...remoteRecord, dirty: false, synced_at: remoteRecord.updated_at },
    ];
    setDB({ ...db, [table]: next });
    emit("storage:synced", table);
    return;
  }

  const local = records[idx];
  if (local.dirty) return; // une modification locale pas encore envoyée prime

  if (new Date(remoteRecord.updated_at) <= new Date(local.updated_at)) return; // rien de plus récent

  const nextRecords = [...records];
  nextRecords[idx] = { ...remoteRecord, dirty: false, synced_at: remoteRecord.updated_at };
  setDB({ ...db, [table]: nextRecords });
  emit("storage:synced", table);
}

/** Nombre total d'enregistrements en attente de synchronisation (toutes tables). */
export function countDirty() {
  const db = getDB();
  return Object.values(TABLES).reduce(
    (sum, table) => sum + (db[table] || []).filter((r) => r.dirty).length,
    0
  );
}

// ----------------------------------------------------------------------------
// Métadonnées globales (userId courant, dernière synchro, ...)
// ----------------------------------------------------------------------------
export function getMeta() {
  return getDB()._meta;
}

export function setMeta(patch) {
  const db = getDB();
  const next = { ...db, _meta: { ...db._meta, ...patch } };
  setDB(next);
  return next._meta;
}

/** Vide entièrement la base locale (utile à la déconnexion, phase 2). */
export function resetDB() {
  return setDB(defaultDB());
}

/** Export brut de la DB (sauvegarde manuelle / debug). */
export function exportDB() {
  return JSON.stringify(getDB(), null, 2);
}
