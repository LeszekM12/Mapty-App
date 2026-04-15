import { qidSafe } from '../utils/dom.js';
// ── Shared network state ──────────────────────────────────────────────────────
export const NetState = {
    isOffline: false,
    mapReady: false,
    retryCount: 0,
    timeoutId: null,
};
// ── Skeleton ──────────────────────────────────────────────────────────────────
export function showSkeleton() {
    qidSafe('mapSkeleton')?.classList.remove('hidden');
}
export function hideSkeleton() {
    qidSafe('mapSkeleton')?.classList.add('hidden');
    if (NetState.timeoutId)
        clearTimeout(NetState.timeoutId);
    qidSafe('skeletonMsg')?.classList.add('hidden');
}
// ── Map timeout ───────────────────────────────────────────────────────────────
const TIMEOUT_MS = 10000;
export function startMapTimeout() {
    if (NetState.timeoutId)
        clearTimeout(NetState.timeoutId);
    NetState.timeoutId = setTimeout(() => {
        if (NetState.mapReady)
            return;
        qidSafe('skeletonMsg')?.classList.remove('hidden');
    }, TIMEOUT_MS);
}
// ── Offline mode ──────────────────────────────────────────────────────────────
function showOfflineToast() {
    qidSafe('offlineToast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'offlineToast';
    toast.className = 'offline-toast';
    toast.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1"/>
    </svg>
    <span>No internet — offline mode</span>`;
    (document.getElementById('map') ?? document.body).appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('offline-toast--visible'));
    setTimeout(() => {
        toast.classList.remove('offline-toast--visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}
export function enterOfflineMode() {
    if (NetState.isOffline)
        return;
    NetState.isOffline = true;
    hideSkeleton();
    qidSafe('offlineBadge')?.classList.remove('hidden');
    showOfflineToast();
}
export function exitOfflineMode(onReconnect) {
    if (!NetState.isOffline)
        return;
    NetState.isOffline = false;
    qidSafe('offlineBadge')?.classList.add('hidden');
    if (!NetState.mapReady) {
        showSkeleton();
        startMapTimeout();
        onReconnect();
    }
}
// ── Online / offline detector ─────────────────────────────────────────────────
export function initOnlineDetector(onReconnect) {
    window.addEventListener('offline', () => enterOfflineMode());
    window.addEventListener('online', () => exitOfflineMode(onReconnect));
    if (!navigator.onLine)
        enterOfflineMode();
}
// ── Retry button ──────────────────────────────────────────────────────────────
export function initRetryBtn(onRetry) {
    qidSafe('btnRetry')?.addEventListener('click', async () => {
        NetState.retryCount++;
        qidSafe('skeletonMsg')?.classList.add('hidden');
        showSkeleton();
        startMapTimeout();
        try {
            const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }));
            onRetry(pos);
        }
        catch {
            if (NetState.retryCount >= 2) {
                const yes = confirm('Could not connect to the map.\nSwitch to offline mode?');
                if (yes)
                    enterOfflineMode();
                else
                    qidSafe('skeletonMsg')?.classList.remove('hidden');
            }
            else {
                qidSafe('skeletonMsg')?.classList.remove('hidden');
            }
        }
    });
}
//# sourceMappingURL=OfflineDetector.js.map