import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Types
export interface Preset {
  id: string;
  name: string;
  description?: string;
  settings: Record<string, unknown>;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VaultJob {
  id: string;
  toolSlug: string;
  timestamp: number;
  inputMeta: Array<{ name: string; size?: number }>;
  settingsSnapshot: Record<string, unknown>;
}

export interface WorkflowStep {
  toolSlug: string;
  settings: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
}

export interface UserDefaults {
  exportFilenamePattern: string;
  preferredQualityPreset: string;
  defaultCurrency: string;
  companyName?: string;
  companyLogo?: string;
  brandColor?: string;
}

// DB Schema
interface WorkToolsDB extends DBSchema {
  presets: {
    key: string;
    value: Preset;
    indexes: { 'by-tool': string };
  };
  vault: {
    key: string;
    value: VaultJob;
    indexes: { 'by-timestamp': number; 'by-tool': string };
  };
  workflows: {
    key: string;
    value: Workflow;
  };
  defaults: {
    key: string;
    value: UserDefaults;
  };
}

const DB_NAME = 'worktools-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<WorkToolsDB> | null = null;

async function getDb(): Promise<IDBPDatabase<WorkToolsDB>> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB<WorkToolsDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Presets store
      if (!db.objectStoreNames.contains('presets')) {
        const presetsStore = db.createObjectStore('presets', { keyPath: 'id' });
        presetsStore.createIndex('by-tool', 'toolSlug');
      }
      
      // Vault store
      if (!db.objectStoreNames.contains('vault')) {
        const vaultStore = db.createObjectStore('vault', { keyPath: 'id' });
        vaultStore.createIndex('by-timestamp', 'timestamp');
        vaultStore.createIndex('by-tool', 'toolSlug');
      }
      
      // Workflows store
      if (!db.objectStoreNames.contains('workflows')) {
        db.createObjectStore('workflows', { keyPath: 'id' });
      }
      
      // Defaults store
      if (!db.objectStoreNames.contains('defaults')) {
        db.createObjectStore('defaults', { keyPath: 'id' });
      }
    },
  });
  
  return dbInstance;
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============ PRESETS ============

export async function listPresets(toolSlug: string): Promise<Preset[]> {
  const db = await getDb();
  const all = await db.getAll('presets');
  return all
    .filter((p) => (p as Preset & { toolSlug?: string }).toolSlug === toolSlug)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
}

export async function upsertPreset(
  toolSlug: string,
  preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Preset> {
  const db = await getDb();
  const now = Date.now();
  
  const fullPreset: Preset & { toolSlug: string } = {
    id: preset.id || generateId(),
    name: preset.name,
    description: preset.description,
    settings: preset.settings,
    pinned: preset.pinned ?? false,
    createdAt: preset.id ? (await db.get('presets', preset.id))?.createdAt || now : now,
    updatedAt: now,
    toolSlug,
  };
  
  await db.put('presets', fullPreset as unknown as Preset);
  return fullPreset;
}

export async function deletePreset(presetId: string): Promise<void> {
  const db = await getDb();
  await db.delete('presets', presetId);
}

export async function setPinned(presetId: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  const preset = await db.get('presets', presetId);
  if (preset) {
    preset.pinned = pinned;
    preset.updatedAt = Date.now();
    await db.put('presets', preset);
  }
}

// ============ VAULT ============

export async function listVaultJobs(): Promise<VaultJob[]> {
  const db = await getDb();
  const jobs = await db.getAll('vault');
  return jobs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function addVaultJob(
  job: Omit<VaultJob, 'id' | 'timestamp'>
): Promise<VaultJob> {
  const db = await getDb();
  
  const fullJob: VaultJob = {
    id: generateId(),
    timestamp: Date.now(),
    ...job,
  };
  
  await db.put('vault', fullJob);
  
  // Prune old jobs
  await pruneOldJobs(100);
  
  return fullJob;
}

export async function deleteVaultJob(jobId: string): Promise<void> {
  const db = await getDb();
  await db.delete('vault', jobId);
}

export async function pruneOldJobs(max: number = 100): Promise<void> {
  const db = await getDb();
  const jobs = await db.getAll('vault');
  
  if (jobs.length > max) {
    const sorted = jobs.sort((a, b) => b.timestamp - a.timestamp);
    const toDelete = sorted.slice(max);
    
    const tx = db.transaction('vault', 'readwrite');
    await Promise.all([
      ...toDelete.map((job) => tx.store.delete(job.id)),
      tx.done,
    ]);
  }
}

export async function clearVault(): Promise<void> {
  const db = await getDb();
  await db.clear('vault');
}

// ============ WORKFLOWS ============

export async function listWorkflows(): Promise<Workflow[]> {
  const db = await getDb();
  const workflows = await db.getAll('workflows');
  return workflows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function upsertWorkflow(
  workflow: Partial<Omit<Workflow, 'createdAt' | 'updatedAt'>> & { name: string; steps: WorkflowStep[] }
): Promise<Workflow> {
  const db = await getDb();
  const now = Date.now();
  
  const fullWorkflow: Workflow = {
    id: workflow.id || generateId(),
    name: workflow.name,
    steps: workflow.steps,
    createdAt: workflow.id ? (await db.get('workflows', workflow.id))?.createdAt || now : now,
    updatedAt: now,
  };
  
  await db.put('workflows', fullWorkflow);
  return fullWorkflow;
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const db = await getDb();
  await db.delete('workflows', workflowId);
}

// ============ DEFAULTS ============

const DEFAULT_USER_DEFAULTS: UserDefaults = {
  exportFilenamePattern: '{toolname}_{date}',
  preferredQualityPreset: 'balanced',
  defaultCurrency: 'EUR',
};

export async function getDefaults(): Promise<UserDefaults> {
  const db = await getDb();
  const stored = await db.get('defaults', 'user-defaults');
  return stored || DEFAULT_USER_DEFAULTS;
}

export async function setDefaults(defaults: Partial<UserDefaults>): Promise<UserDefaults> {
  const db = await getDb();
  const current = await getDefaults();
  const updated = { ...current, ...defaults };
  await db.put('defaults', { ...updated, id: 'user-defaults' } as unknown as UserDefaults);
  return updated;
}

// ============ CLEAR ALL DATA ============

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear('presets'),
    db.clear('vault'),
    db.clear('workflows'),
    db.clear('defaults'),
  ]);
}

// ============ LAST USED SETTINGS ============

export async function getLastSettings(toolSlug: string): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const jobs = await db.getAll('vault');
  const toolJobs = jobs.filter((j) => j.toolSlug === toolSlug);
  if (toolJobs.length === 0) return null;
  const latest = toolJobs.sort((a, b) => b.timestamp - a.timestamp)[0];
  return latest.settingsSnapshot;
}
