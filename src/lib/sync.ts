import { storage } from './storage';
import { SyncRecord } from '../types';
import { supabase } from './supabase';

export type SyncStatus = 'success' | 'pending' | 'error';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let lastSyncTime: number | null = null;
let currentStatus: SyncStatus = 'success';
let listeners: ((status: SyncStatus, lastSync: number | null, pendingCount: number) => void)[] = [];

type SupabaseScoutRow = {
  id: string;
  data: unknown;
  updated_at: string;
};

function normalizeJsonPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export const syncManager = {
  start() {
    if (syncInterval) return;
    this.initialSync();
    syncInterval = setInterval(() => this.sync(), 15000);
  },

  stop() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  },

  subscribe(listener: (status: SyncStatus, lastSync: number | null, pendingCount: number) => void) {
    listeners.push(listener);
    this.notify();
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },

  notify() {
    const queue = storage.getSyncQueue();
    const pendingCount = queue.length;
    
    if (pendingCount > 0 && currentStatus === 'success') {
      currentStatus = 'pending';
    } else if (pendingCount === 0 && currentStatus === 'pending') {
      currentStatus = 'success';
    }

    listeners.forEach(l => l(currentStatus, lastSyncTime, pendingCount));
  },

  async initialSync() {
    try {
      const [pitResult, matchResult] = await Promise.all([
        supabase.from('pit_scouts').select('id, data, updated_at'),
        supabase.from('match_scouts').select('id, data, updated_at'),
      ]);

      if (pitResult.error) {
        throw pitResult.error;
      }

      if (matchResult.error) {
        throw matchResult.error;
      }

      (pitResult.data || []).forEach((row: SupabaseScoutRow) => {
        const record = {
          id: row.id,
          type: 'pitScout',
          timestamp: new Date(row.updated_at).getTime(),
          data: normalizeJsonPayload(row.data),
        } as SyncRecord<any>;

        const key = `pitScout:${record.data.teamNumber}`;
        const localRecord = storage.get<SyncRecord<any>>(key);
        if (!localRecord || record.timestamp > localRecord.timestamp) {
          storage.set(key, record);
        }
      });

      (matchResult.data || []).forEach((row: SupabaseScoutRow) => {
        const record = {
          id: row.id,
          type: 'matchScout',
          timestamp: new Date(row.updated_at).getTime(),
          data: normalizeJsonPayload(row.data),
        } as SyncRecord<any>;

        const key = `matchScout:${record.data.matchNumber}:${record.data.teamNumber}`;
        const localRecord = storage.get<SyncRecord<any>>(key);
        if (!localRecord || record.timestamp > localRecord.timestamp) {
          storage.set(key, record);
        }
      });

      lastSyncTime = Date.now();
      currentStatus = storage.getSyncQueue().length > 0 ? 'pending' : 'success';
    } catch (error) {
      console.error('Initial sync failed:', error);
      currentStatus = 'error';
    }
    this.notify();
  },

  async sync() {
    const queue = storage.getSyncQueue();
    if (queue.length === 0) {
      this.notify();
      return;
    }

    try {
      const pitRows = queue
        .filter(record => record.type === 'pitScout')
        .map(record => ({
          id: record.id,
          team_number: toNullableNumber((record.data as any)?.teamNumber),
          data: record.data,
          updated_at: new Date(record.timestamp).toISOString(),
        }));

      const matchRows = queue
        .filter(record => record.type === 'matchScout')
        .map(record => ({
          id: record.id,
          match_number: toNullableNumber((record.data as any)?.matchNumber),
          team_number: toNullableNumber((record.data as any)?.teamNumber),
          alliance: (record.data as any)?.allianceColor || null,
          data: record.data,
          updated_at: new Date(record.timestamp).toISOString(),
        }));

      const [pitResult, matchResult] = await Promise.all([
        pitRows.length > 0 ? supabase.from('pit_scouts').upsert(pitRows, { onConflict: 'id' }) : Promise.resolve({ error: null }),
        matchRows.length > 0 ? supabase.from('match_scouts').upsert(matchRows, { onConflict: 'id' }) : Promise.resolve({ error: null }),
      ]);

      if (pitResult.error || matchResult.error) {
        currentStatus = 'error';
      } else {
        storage.removeFromSyncQueue(queue.map(r => r.id));
        lastSyncTime = Date.now();
        currentStatus = 'success';
        window.dispatchEvent(new CustomEvent('sync-success'));
      }
    } catch (error) {
      console.error('Sync failed:', error);
      currentStatus = 'error';
    }
    
    this.notify();
  }
};
