// ─── GEOGRAPHIC UTILITIES ────────────────────────────────────────────────────
import { Coords } from '../types/index.js';

/** Haversine distance between two lat/lng points — returns metres */
export function haversine(a: Coords, b: Coords): number {
  const R  = 6371e3;
  const φ1 = (a[0] * Math.PI) / 180;
  const φ2 = (b[0] * Math.PI) / 180;
  const Δφ = ((b[0] - a[0]) * Math.PI) / 180;
  const Δλ = ((b[1] - a[1]) * Math.PI) / 180;
  const x  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** OSM tile X index for a longitude at a given zoom */
export function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

/** OSM tile Y index for a latitude at a given zoom */
export function latToTileY(lat: number, zoom: number): number {
  const r = Math.PI / 180;
  return Math.floor(
    (1 - Math.log(Math.tan(lat * r) + 1 / Math.cos(lat * r)) / Math.PI) /
      2 *
      Math.pow(2, zoom),
  );
}

/** Week bounds: returns Monday 00:00:00 and Sunday 23:59:59 for a given offset */
export function getWeekBounds(offsetWeeks: number): { mon: Date; sun: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon + offsetWeeks * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { mon, sun };
}
