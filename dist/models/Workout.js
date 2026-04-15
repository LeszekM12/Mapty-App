// ─── WORKOUT MODELS ──────────────────────────────────────────────────────────
import { WorkoutType } from '../types/index.js';
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
// ── Base class ────────────────────────────────────────────────────────────
export class Workout {
    constructor(coords, distance, duration) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "date", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "coords", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "distance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // km
        Object.defineProperty(this, "duration", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        }); // min
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "routeCoords", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "clicks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.coords = coords;
        this.distance = distance;
        this.duration = duration;
        this.date = new Date();
        this.id = String(Date.now()).slice(-10);
    }
    _setDescription() {
        const label = this.type[0].toUpperCase() + this.type.slice(1);
        this.description = `${label} on ${MONTHS[this.date.getMonth()]} ${this.date.getDate()}`;
    }
    click() { this.clicks++; }
    /** Rehydrate a plain data object back into a typed Workout instance. */
    static fromData(data) {
        const t = data.type;
        const coords = data.coords;
        const distance = data.distance;
        const duration = data.duration;
        let w;
        if (t === WorkoutType.Running) {
            w = new Running(coords, distance, duration, data.cadence);
        }
        else if (t === WorkoutType.Cycling) {
            w = new Cycling(coords, distance, duration, (data.elevationGain ?? data.elevGain ?? 0));
        }
        else {
            w = new Walking(coords, distance, duration, data.cadence);
        }
        // Restore persisted fields
        w.id = data.id;
        w.date = new Date(data.date);
        w.description = data.description;
        w.routeCoords = data.routeCoords ?? null;
        return w;
    }
    /** Serialise to a plain object for localStorage / IndexedDB. */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            coords: this.coords,
            date: this.date.toISOString(),
            distance: this.distance,
            duration: this.duration,
            description: this.description,
            routeCoords: this.routeCoords,
        };
    }
}
// ── Running ───────────────────────────────────────────────────────────────
export class Running extends Workout {
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: WorkoutType.Running
        });
        Object.defineProperty(this, "cadence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // min/km
        this.cadence = cadence;
        this.pace = this.calcPace();
        this._setDescription();
    }
    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace;
    }
    toJSON() {
        return { ...super.toJSON(), cadence: this.cadence, pace: this.pace };
    }
}
// ── Cycling ───────────────────────────────────────────────────────────────
export class Cycling extends Workout {
    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: WorkoutType.Cycling
        });
        Object.defineProperty(this, "elevationGain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "speed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // km/h
        this.elevationGain = elevationGain;
        this.speed = this.calcSpeed();
        this._setDescription();
    }
    calcSpeed() {
        this.speed = this.distance / (this.duration / 60);
        return this.speed;
    }
    toJSON() {
        return { ...super.toJSON(), elevationGain: this.elevationGain, elevGain: this.elevationGain, speed: this.speed };
    }
}
// ── Walking ───────────────────────────────────────────────────────────────
export class Walking extends Workout {
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: WorkoutType.Walking
        });
        Object.defineProperty(this, "cadence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "pace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }); // min/km
        this.cadence = cadence;
        this.pace = this.calcPace();
        this._setDescription();
    }
    calcPace() {
        this.pace = this.duration / this.distance;
        return this.pace;
    }
    toJSON() {
        return { ...super.toJSON(), cadence: this.cadence, pace: this.pace };
    }
}
//# sourceMappingURL=Workout.js.map