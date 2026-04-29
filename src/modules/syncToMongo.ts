// ─── SYNC TO MONGODB + CLOUDINARY ────────────────────────────────────────────
// src/modules/syncToMongo.ts

import { BACKEND_URL } from '../config.js';
import {
  loadWorkoutsFromDB,
  loadActivities,
  loadEnrichedActivities,
  loadUnifiedWorkouts,
  loadPosts,
  loadProfileFromDB,
  db,
  type EnrichedActivity,
  type PostRecord,
  type ProfileRecord,
} from './db.js';
import { getUserId } from './PushNotifications.js';

const LS_SYNCED_KEY  = 'mapyou_mongo_synced';
const LS_SYNC_FAILED = 'mapyou_mongo_sync_failed_at';
const RETRY_AFTER_MS = 5 * 60 * 1000;

async function waitForDexie(timeoutMs = 10_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await db.open();
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  console.warn('[Sync] Dexie not ready after timeout');
  return false;
}

async function uploadImageToCloudinary(
  base64: string, userId: string,
  folder: 'activities' | 'posts' | 'avatars',
  publicId?: string,
): Promise<string | null> {
  if (!base64 || !base64.startsWith('data:image/')) return base64 || null;
  try {
    const res = await fetch(`${BACKEND_URL}/upload/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, userId, folder, publicId }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { status: string; url: string };
    return data.status === 'ok' ? data.url : null;
  } catch { return null; }
}

async function migratePhotos(
  userId: string,
  enrichedActivities: EnrichedActivity[],
  posts: PostRecord[],
  profile: ProfileRecord | null,
) {
  console.log('[Sync] Uploading photos to Cloudinary...');
  const migratedActivities = await Promise.all(
    enrichedActivities.map(async (a) => {
      if (!a.photoUrl?.startsWith('data:image/')) return a;
      const url = await uploadImageToCloudinary(a.photoUrl, userId, 'activities');
      return { ...a, photoUrl: url };
    }),
  );
  const migratedPosts = await Promise.all(
    posts.map(async (p) => {
      if (!p.photoUrl?.startsWith('data:image/')) return p;
      const url = await uploadImageToCloudinary(p.photoUrl, userId, 'posts');
      return { ...p, photoUrl: url };
    }),
  );
  let migratedProfile = profile;
  if (profile?.avatarB64?.startsWith('data:image/')) {
    const url = await uploadImageToCloudinary(
      profile.avatarB64, userId, 'avatars',
      `mapyou/avatars/${userId}/avatar`,
    );
    migratedProfile = url
      ? { ...profile, avatarB64: null, avatarUrl: url } as unknown as ProfileRecord
      : profile;
  }
  return { enrichedActivities: migratedActivities as EnrichedActivity[], posts: migratedPosts as PostRecord[], profile: migratedProfile };
}

export async function syncToMongoIfNeeded(): Promise<void> {
  if (localStorage.getItem(LS_SYNCED_KEY) === 'true') return;

  const lastFailed = Number(localStorage.getItem(LS_SYNC_FAILED) ?? 0);
  if (lastFailed > 0 && Date.now() - lastFailed < RETRY_AFTER_MS) return;

  const userId = getUserId();
  console.log(`[Sync] Starting for userId=${userId}`);

  const dexieReady = await waitForDexie();
  if (!dexieReady) { _markFailed(); return; }
  console.log('[Sync] Dexie ready');

  try {
    const healthRes = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(8000) });
    if (!healthRes.ok) { _markFailed(); return; }
    console.log('[Sync] Backend alive');

    const statusRes = await fetch(
      `${BACKEND_URL}/migrate/status/${encodeURIComponent(userId)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!statusRes.ok) { _markFailed(); return; }

    const statusData = await statusRes.json() as { status: string; counts: Record<string, number> };
    const totalInAtlas = Object.values(statusData.counts).reduce((a, b) => a + b, 0);
    console.log(`[Sync] Atlas has ${totalInAtlas} records for this user`);

    if (totalInAtlas > 0) {
      _markSynced();
      console.log(`[Sync] Already synced (${totalInAtlas} records)`);
      return;
    }

    const [workouts, activities, enrichedActivities, unifiedWorkouts, posts, profile] =
      await Promise.all([
        loadWorkoutsFromDB(), loadActivities(), loadEnrichedActivities(),
        loadUnifiedWorkouts(), loadPosts(), loadProfileFromDB(),
      ]);

    console.log(`[Sync] IndexedDB: workouts=${workouts.length} activities=${activities.length} enriched=${enrichedActivities.length} unified=${unifiedWorkouts.length} posts=${posts.length}`);

    const totalLocal = workouts.length + activities.length + enrichedActivities.length + unifiedWorkouts.length + posts.length;

    if (totalLocal === 0) {
      _markSynced();
      console.log('[Sync] IndexedDB empty — nothing to migrate');
      return;
    }

    console.log(`[Sync] Migrating ${totalLocal} records...`);

    const { enrichedActivities: migratedActivities, posts: migratedPosts, profile: migratedProfile } =
      await migratePhotos(userId, enrichedActivities, posts, profile);

    const migrateRes = await fetch(`${BACKEND_URL}/migrate/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId, workouts, activities,
        enrichedActivities: migratedActivities,
        unifiedWorkouts, posts: migratedPosts,
        profile: migratedProfile ?? undefined,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!migrateRes.ok) { console.error('[Sync] migrate/bulk failed:', migrateRes.status); _markFailed(); return; }

    const migrateData = await migrateRes.json() as { status: string; summary: Record<string, number> };
    if (migrateData.status === 'ok') {
      _markSynced();
      console.log('[Sync] Migration complete:', migrateData.summary);
    } else { _markFailed(); }

  } catch (err) {
    _markFailed();
    console.warn('[Sync] Error:', err);
  }
}

function _markSynced(): void {
  localStorage.setItem(LS_SYNCED_KEY, 'true');
  localStorage.removeItem(LS_SYNC_FAILED);
}

function _markFailed(): void {
  localStorage.setItem(LS_SYNC_FAILED, String(Date.now()));
}

export function resetSyncFlag(): void {
  localStorage.removeItem(LS_SYNCED_KEY);
  localStorage.removeItem(LS_SYNC_FAILED);
  console.log('[Sync] Sync flag reset');
}

(window as unknown as Record<string, unknown>).resetSync = resetSyncFlag;
