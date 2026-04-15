// ─── ROUTE PLANNER ───────────────────────────────────────────────────────────
/// <reference types="leaflet" />
import { ActivityMode } from '../types/index.js';
import { qidSafe, show, hide } from '../utils/dom.js';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1';
const ACTIVITY_SPEEDS = {
    [ActivityMode.Running]: 10,
    [ActivityMode.Cycling]: 20,
    [ActivityMode.Walking]: 5,
};
export class RoutePlanner {
    constructor(map, onRouteReady) {
        Object.defineProperty(this, "map", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "mode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ActivityMode.Running
        });
        Object.defineProperty(this, "active", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "step", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "pointA", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pointB", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "markerA", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "markerB", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "routingCtrl", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "onRouteReady", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Last computed route coords (saved to workout)
        Object.defineProperty(this, "lastRouteCoords", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "lastRouteDist", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.map = map;
        this.onRouteReady = onRouteReady;
    }
    get isActive() { return this.active; }
    get currentStep() { return this.step; }
    get activityMode() { return this.mode; }
    /** Start route planning mode */
    start() {
        this.active = true;
        this.step = 1;
        this.pointA = null;
        this.pointB = null;
        hide(qidSafe('btnRoute'));
        show(qidSafe('routeInfo'));
        hide(qidSafe('routeResult'));
        const stepA = qidSafe('stepAText');
        const stepB = qidSafe('stepBText');
        if (stepA)
            stepA.textContent = 'Click the start point on the map';
        if (stepB)
            stepB.textContent = 'Click the end point on the map';
        this.map.getContainer().style.cursor = 'crosshair';
    }
    /** Cancel and clean up */
    cancel() {
        this.active = false;
        this.step = 0;
        this.pointA = null;
        this.pointB = null;
        if (this.markerA) {
            this.map.removeLayer(this.markerA);
            this.markerA = null;
        }
        if (this.markerB) {
            this.map.removeLayer(this.markerB);
            this.markerB = null;
        }
        // @ts-ignore
        if (this.routingCtrl) {
            this.map.removeControl(this.routingCtrl);
            this.routingCtrl = null;
        }
        this.lastRouteCoords = [];
        this.lastRouteDist = 0;
        show(qidSafe('btnRoute'));
        hide(qidSafe('routeInfo'));
        hide(qidSafe('routeResult'));
        hide(qidSafe('routeLoading'));
        this.map.getContainer().style.cursor = '';
    }
    /** Handle a map click during route planning */
    handleClick(latlng) {
        if (!this.active)
            return;
        if (this.step === 1) {
            this.pointA = [latlng.lat, latlng.lng];
            this.step = 2;
            if (this.markerA)
                this.map.removeLayer(this.markerA);
            this.markerA = L.marker(latlng, {
                icon: L.divIcon({ className: '', html: '<div class="route-marker route-marker--a">A</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
            }).addTo(this.map);
            const t = qidSafe('stepAText');
            if (t) {
                t.textContent = 'Start point set ✓';
                t.closest('.route-info__step')?.classList.add('route-info__step--done');
            }
        }
        else if (this.step === 2) {
            this.pointB = [latlng.lat, latlng.lng];
            this.step = 3;
            if (this.markerB)
                this.map.removeLayer(this.markerB);
            this.markerB = L.marker(latlng, {
                icon: L.divIcon({ className: '', html: '<div class="route-marker route-marker--b">B</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
            }).addTo(this.map);
            const t = qidSafe('stepBText');
            if (t) {
                t.textContent = 'End point set ✓';
                t.closest('.route-info__step')?.classList.add('route-info__step--done');
            }
            void this.draw();
        }
    }
    /** Set preselected point A (e.g. from POI search) */
    setPointA(coords) {
        if (!this.active)
            this.start();
        this.pointA = coords;
        this.step = 2;
        if (this.markerA)
            this.map.removeLayer(this.markerA);
        this.markerA = L.marker(L.latLng(coords[0], coords[1]), {
            icon: L.divIcon({ className: '', html: '<div class="route-marker route-marker--a">A</div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
        }).addTo(this.map);
        const t = qidSafe('stepAText');
        if (t)
            t.textContent = 'Start point set ✓';
        this.map.setView(coords, 15);
    }
    /** Change activity mode (running/cycling/walking) */
    setMode(mode) {
        this.mode = mode;
    }
    // ── Private: draw route via OSRM ─────────────────────────────────────────
    async draw() {
        if (!this.pointA || !this.pointB)
            return;
        show(qidSafe('routeLoading'));
        hide(qidSafe('routeResult'));
        if (this.routingCtrl) {
            this.map.removeControl(this.routingCtrl);
            this.routingCtrl = null;
        }
        const profile = this.mode === ActivityMode.Cycling ? 'bike' : 'foot';
        const [aLat, aLng] = this.pointA;
        const [bLat, bLng] = this.pointB;
        try {
            const url = `${OSRM_BASE}/${profile}/${aLng},${aLat};${bLng},${bLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            if (!data.routes?.length)
                throw new Error('No route found');
            const route = data.routes[0];
            this.lastRouteDist = route.distance;
            this.lastRouteCoords = route.geometry.coordinates.map(c => [c[1], c[0]]);
            const distKm = (route.distance / 1000).toFixed(2);
            const mins = Math.round((parseFloat(distKm) / ACTIVITY_SPEEDS[this.mode]) * 60);
            const rDist = qidSafe('routeDist');
            const rTime = qidSafe('routeTime');
            if (rDist)
                rDist.textContent = distKm;
            if (rTime)
                rTime.textContent = String(mins);
            hide(qidSafe('routeLoading'));
            show(qidSafe('routeResult'));
            // Draw polyline via Leaflet Routing Machine
            const customRouter = {
                route: (wps, cb) => {
                    const coords = this.lastRouteCoords.map(c => L.latLng(c[0], c[1]));
                    cb(null, [{ name: '', summary: { totalDistance: route.distance, totalTime: route.duration }, coordinates: coords, waypoints: wps, inputWaypoints: wps }]);
                },
            };
            this.routingCtrl = L.Routing.control({
                waypoints: [L.latLng(aLat, aLng), L.latLng(bLat, bLng)],
                router: customRouter,
                routeWhileDragging: false, addWaypoints: false, draggableWaypoints: false,
                fitSelectedRoutes: true, show: false,
                lineOptions: { styles: [{ color: '#00c46a', weight: 6, opacity: 0.85 }] },
                createMarker: () => null,
            }).addTo(this.map);
            this.onRouteReady?.({ distKm: parseFloat(distKm), timeMin: mins, coords: this.lastRouteCoords });
        }
        catch {
            hide(qidSafe('routeLoading'));
            const rDist = qidSafe('routeDist');
            const rTime = qidSafe('routeTime');
            if (rDist)
                rDist.textContent = 'Error';
            if (rTime)
                rTime.textContent = '—';
            show(qidSafe('routeResult'));
        }
    }
    /** Initialise route mode buttons */
    initControls(onStart, onCancel) {
        qidSafe('btnRoute')?.addEventListener('click', () => {
            this.start();
            onStart?.();
        });
        qidSafe('btnCancelRoute')?.addEventListener('click', () => {
            this.cancel();
            onCancel?.();
        });
        document.querySelectorAll('.route-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('route-mode-btn--active'));
                btn.classList.add('route-mode-btn--active');
                this.setMode(btn.dataset.mode);
            });
        });
    }
}
//# sourceMappingURL=RoutePlanner.js.map