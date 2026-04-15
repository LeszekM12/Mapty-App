import { NetState } from './OfflineDetector.js';
const TILES = {
    day: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    night: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const TILE_ATTR = {
    day: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    night: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
};
export class MapView {
    constructor() {
        Object.defineProperty(this, "map", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tileLayer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "nightMode", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: localStorage.getItem('nightMode') === 'true'
        });
        Object.defineProperty(this, "defaultZoom", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 13
        });
    }
    get leafletMap() { return this.map; }
    get isReady() { return !!this.map; }
    /** Initialise Leaflet map at given coords */
    init(coords, onTileLoad, onMapClick) {
        this.map = L.map('map').setView(coords, this.defaultZoom);
        // Custom pane for progress line (above route polyline, below markers)
        this.map.createPane('progressPane');
        const pane = this.map.getPane('progressPane');
        if (pane)
            pane.style.zIndex = '650';
        const tileKey = this.nightMode ? 'night' : 'day';
        this.tileLayer = L.tileLayer(TILES[tileKey], { attribution: TILE_ATTR[tileKey] })
            .addTo(this.map);
        this.tileLayer.once('load', () => {
            NetState.mapReady = true;
            NetState.retryCount = 0;
            if (NetState.timeoutId)
                clearTimeout(NetState.timeoutId);
            document.getElementById('mapSkeleton')?.classList.add('hidden');
            document.getElementById('skeletonMsg')?.classList.add('hidden');
            onTileLoad();
        });
        this.map.on('click', onMapClick);
    }
    setView(coords, zoom) {
        if (!this.isReady)
            return;
        this.map.setView(coords, zoom ?? this.defaultZoom, { animate: true });
    }
    flyTo(coords, zoom = 15) {
        this.map.flyTo(coords, zoom);
    }
    invalidateSize() { if (this.isReady)
        this.map.invalidateSize(); }
    toggleNightMode() {
        this.nightMode = !this.nightMode;
        localStorage.setItem('nightMode', String(this.nightMode));
        if (this.tileLayer)
            this.map.removeLayer(this.tileLayer);
        const key = this.nightMode ? 'night' : 'day';
        this.tileLayer = L.tileLayer(TILES[key], { attribution: TILE_ATTR[key] }).addTo(this.map);
    }
    get isNightMode() { return this.nightMode; }
    createCustomPane(name, zIndex) {
        if (!this.map.getPane(name)) {
            this.map.createPane(name);
            const pane = this.map.getPane(name);
            if (pane)
                pane.style.zIndex = String(zIndex);
        }
    }
}
//# sourceMappingURL=MapView.js.map