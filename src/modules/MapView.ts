// ─── MAP VIEW ────────────────────────────────────────────────────────────────
/// <reference types="leaflet" />
import { Coords, TileMode } from '../types/index.js';
import { NetState } from './OfflineDetector.js';

const TILES: Record<TileMode, string> = {
  day:   'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  night: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const TILE_ATTR: Record<TileMode, string> = {
  day:   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  night: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
};

export class MapView {
  private map!:       L.Map;
  private tileLayer!: L.TileLayer;
  private nightMode:  boolean = localStorage.getItem('nightMode') === 'true';
  private readonly defaultZoom = 13;

  get leafletMap(): L.Map { return this.map; }
  get isReady():    boolean { return !!(this.map as L.Map | undefined); }

  /** Initialise Leaflet map at given coords */
  init(
    coords:      Coords,
    onTileLoad:  () => void,
    onMapClick:  (e: L.LeafletMouseEvent) => void,
  ): void {
    this.map = L.map('map').setView(coords, this.defaultZoom);

    // Custom pane for progress line (above route polyline, below markers)
    this.map.createPane('progressPane');
    const pane = this.map.getPane('progressPane');
    if (pane) pane.style.zIndex = '650';

    const tileKey: TileMode = this.nightMode ? 'night' : 'day';
    this.tileLayer = L.tileLayer(TILES[tileKey], { attribution: TILE_ATTR[tileKey] })
      .addTo(this.map);

    this.tileLayer.once('load', () => {
      NetState.mapReady    = true;
      NetState.retryCount  = 0;
      if (NetState.timeoutId) clearTimeout(NetState.timeoutId);
      document.getElementById('mapSkeleton')?.classList.add('hidden');
      document.getElementById('skeletonMsg')?.classList.add('hidden');
      onTileLoad();
    });

    this.map.on('click', onMapClick);
  }

  setView(coords: Coords, zoom?: number): void {
    if (!this.isReady) return;
    this.map.setView(coords, zoom ?? this.defaultZoom, { animate: true });
  }

  flyTo(coords: Coords, zoom = 15): void {
    this.map.flyTo(coords, zoom);
  }

  invalidateSize(): void { if (this.isReady) this.map.invalidateSize(); }

  toggleNightMode(): void {
    this.nightMode = !this.nightMode;
    localStorage.setItem('nightMode', String(this.nightMode));
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);
    const key: TileMode = this.nightMode ? 'night' : 'day';
    this.tileLayer = L.tileLayer(TILES[key], { attribution: TILE_ATTR[key] }).addTo(this.map);
  }

  get isNightMode(): boolean { return this.nightMode; }

  createCustomPane(name: string, zIndex: number): void {
    if (!this.map.getPane(name)) {
      this.map.createPane(name);
      const pane = this.map.getPane(name);
      if (pane) pane.style.zIndex = String(zIndex);
    }
  }
}
