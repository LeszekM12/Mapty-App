// ─── SHARED TYPES & INTERFACES ───────────────────────────────────────────────

/** [latitude, longitude] */
export type Coords = [number, number];

// ── Workout types ──────────────────────────────────────────────────────────

export enum WorkoutType {
  Running = 'running',
  Cycling = 'cycling',
  Walking = 'walking',
}

export interface WorkoutData {
  id:          string;
  type:        WorkoutType;
  coords:      Coords;
  date:        string;          // ISO string
  distance:    number;          // km
  duration:    number;          // min
  description: string;
  routeCoords?: Coords[] | null;
  // Running / Walking
  cadence?:    number;
  pace?:       number;          // min/km
  // Cycling
  elevationGain?: number;       // m
  speed?:      number;          // km/h
}

// ── Map / Route ────────────────────────────────────────────────────────────

export enum ActivityMode {
  Running = 'running',
  Cycling = 'cycling',
  Walking = 'walking',
}

export type TileMode = 'day' | 'night';

export interface RouteResult {
  distKm:   number;
  timeMin:  number;
  coords:   Coords[];
}

// ── Offline / network ──────────────────────────────────────────────────────

export interface NetStateType {
  isOffline:  boolean;
  mapReady:   boolean;
  retryCount: number;
  timeoutId:  ReturnType<typeof setTimeout> | null;
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface AppSettings {
  nightMode:      boolean;
  voiceEnabled:   boolean;
  clusterEnabled: boolean;
}

// ── Weather ────────────────────────────────────────────────────────────────

export interface WeatherData {
  icon:   string;
  sunset: string;   // e.g. "19:42"
}

export interface OpenMeteoResponse {
  current: { weathercode: number };
  daily:   { sunset: string[] };
}

// ── Custom POI filter ──────────────────────────────────────────────────────

export interface CustomFilter {
  name:    string;
  emoji:   string;
  coords:  Coords;
  address: string;
}

// ── Stats ──────────────────────────────────────────────────────────────────

export interface WeekBounds {
  mon: Date;
  sun: Date;
}
