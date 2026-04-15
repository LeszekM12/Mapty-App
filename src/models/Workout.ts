// ─── WORKOUT MODELS ──────────────────────────────────────────────────────────
import { Coords, WorkoutType } from '../types/index.js';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;

// ── Base class ────────────────────────────────────────────────────────────

export abstract class Workout {
  readonly id:       string;
  readonly date:     Date;
  abstract readonly type: WorkoutType;

  coords:      Coords;
  distance:    number;       // km
  duration:    number;       // min
  description: string = '';
  routeCoords: Coords[] | null = null;
  clicks:      number = 0;

  constructor(coords: Coords, distance: number, duration: number) {
    this.coords   = coords;
    this.distance = distance;
    this.duration = duration;
    this.date     = new Date();
    this.id       = String(Date.now()).slice(-10);
  }

  protected _setDescription(): void {
    const label = this.type[0].toUpperCase() + this.type.slice(1);
    this.description = `${label} on ${MONTHS[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  click(): void { this.clicks++; }

  /** Rehydrate a plain data object back into a typed Workout instance. */
  static fromData(data: Record<string, unknown>): Workout {
    const t = data.type as WorkoutType;
    const coords   = data.coords   as Coords;
    const distance = data.distance as number;
    const duration = data.duration as number;

    let w: Workout;

    if (t === WorkoutType.Running) {
      w = new Running(coords, distance, duration, data.cadence as number);
    } else if (t === WorkoutType.Cycling) {
      w = new Cycling(coords, distance, duration, (data.elevationGain ?? data.elevGain ?? 0) as number);
    } else {
      w = new Walking(coords, distance, duration, data.cadence as number);
    }

    // Restore persisted fields
    (w as { id: string }).id           = data.id as string;
    (w as { date: Date }).date         = new Date(data.date as string);
    w.description                      = data.description as string;
    w.routeCoords                      = (data.routeCoords as Coords[] | null) ?? null;

    return w;
  }

  /** Serialise to a plain object for localStorage / IndexedDB. */
  toJSON(): Record<string, unknown> {
    return {
      id:          this.id,
      type:        this.type,
      coords:      this.coords,
      date:        this.date.toISOString(),
      distance:    this.distance,
      duration:    this.duration,
      description: this.description,
      routeCoords: this.routeCoords,
    };
  }
}

// ── Running ───────────────────────────────────────────────────────────────

export class Running extends Workout {
  readonly type = WorkoutType.Running;
  cadence: number;
  pace:    number = 0;    // min/km

  constructor(coords: Coords, distance: number, duration: number, cadence: number) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.pace    = this.calcPace();
    this._setDescription();
  }

  calcPace(): number {
    this.pace = this.duration / this.distance;
    return this.pace;
  }

  override toJSON() {
    return { ...super.toJSON(), cadence: this.cadence, pace: this.pace };
  }
}

// ── Cycling ───────────────────────────────────────────────────────────────

export class Cycling extends Workout {
  readonly type = WorkoutType.Cycling;
  elevationGain: number;
  speed: number = 0;      // km/h

  constructor(coords: Coords, distance: number, duration: number, elevationGain: number) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.speed         = this.calcSpeed();
    this._setDescription();
  }

  calcSpeed(): number {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }

  override toJSON() {
    return { ...super.toJSON(), elevationGain: this.elevationGain, elevGain: this.elevationGain, speed: this.speed };
  }
}

// ── Walking ───────────────────────────────────────────────────────────────

export class Walking extends Workout {
  readonly type = WorkoutType.Walking;
  cadence: number;
  pace:    number = 0;    // min/km

  constructor(coords: Coords, distance: number, duration: number, cadence: number) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.pace    = this.calcPace();
    this._setDescription();
  }

  calcPace(): number {
    this.pace = this.duration / this.distance;
    return this.pace;
  }

  override toJSON() {
    return { ...super.toJSON(), cadence: this.cadence, pace: this.pace };
  }
}
