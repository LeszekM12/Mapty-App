// ─── STATS PANEL ─────────────────────────────────────────────────────────────
import { Workout } from '../models/Workout.js';
import { WorkoutType } from '../types/index.js';
import { qidSafe } from '../utils/dom.js';
import { getWeekBounds } from '../utils/geo.js';

// ── Bar colour per type ───────────────────────────────────────────────────────

const TYPE_COLOR: Record<WorkoutType, string> = {
  [WorkoutType.Running]: '#00c46a',
  [WorkoutType.Cycling]: '#ffb545',
  [WorkoutType.Walking]: '#5badea',
};

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const;
const CIRC = 226.2;

// ── Ring helper ───────────────────────────────────────────────────────────────

function setRing(id: string, pct: number, animate: boolean): void {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = Math.max(0, CIRC - Math.min(pct, 1) * CIRC);
  if (animate) {
    el.style.transition = 'none';
    el.setAttribute('stroke-dashoffset', String(CIRC));
    void el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)';
  }
  requestAnimationFrame(() => el.setAttribute('stroke-dashoffset', offset.toFixed(1)));
}

function setText(id: string, value: string | number): void {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function fmtTime(min: number): string {
  return min >= 60
    ? `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`
    : `${Math.round(min)}m`;
}

// ── Module state ──────────────────────────────────────────────────────────────

interface StatsPanelState {
  weekOffset:    number;
  selectedDay:   number | null;
  expanded:      boolean;
  goalKm:        number;
  goalTime:      number;
  goalCount:     number;
  prevGoalReached: boolean;
}

// ── Public class ──────────────────────────────────────────────────────────────

export class StatsPanel {
  private state: StatsPanelState = {
    weekOffset:      0,
    selectedDay:     null,
    expanded:        false,
    goalKm:          +(localStorage.getItem('goalKm')    || 35),
    goalTime:        +(localStorage.getItem('goalTime')  || 300),
    goalCount:       +(localStorage.getItem('goalCount') || 7),
    prevGoalReached: false,
  };

  private workouts: Workout[] = [];

  constructor(private onGoalReached: () => void) {}

  setWorkouts(workouts: Workout[]): void {
    this.workouts = workouts;
  }

  /** Render stats — call after any workout change. */
  render(animate = false): void {
    const { mon } = getWeekBounds(this.state.weekOffset);
    const weekW   = this.getWeekWorkouts();

    const wKm  = weekW.reduce((s, w) => s + w.distance, 0);
    const wMin = weekW.reduce((s, w) => s + w.duration, 0);
    const wCnt = weekW.length;

    // Rings
    setRing('statsRingKm',       wKm  / this.state.goalKm,    animate);
    setRing('statsRingTime',     wMin / this.state.goalTime,   animate);
    setRing('statsRingWorkouts', wCnt / this.state.goalCount,  animate);

    // Values
    setText('statsValKm',       wKm.toFixed(1));
    setText('statsValTime',     fmtTime(wMin));
    setText('statsValWorkouts', wCnt);

    // Goal bar
    const pct = Math.min(Math.round((wKm / this.state.goalKm) * 100), 100);
    setText('statsGoalPct', `${pct}%`);
    const fill = qidSafe<HTMLElement>('statsGoalFill');
    if (fill) fill.style.width = `${pct}%`;

    // Celebration
    if (pct >= 100 && !this.state.prevGoalReached && animate) {
      this.state.prevGoalReached = true;
      this.onGoalReached();
    } else if (pct < 100) {
      this.state.prevGoalReached = false;
    }

    // Week label
    if (this.state.weekOffset === 0) {
      setText('statsWeekLabel', 'This week');
      const nxt = qidSafe<HTMLButtonElement>('statsWeekNext');
      if (nxt) nxt.disabled = true;
    } else {
      const su = new Date(mon);
      su.setDate(mon.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      setText('statsWeekLabel', `${fmt(mon)}–${fmt(su)}`);
      const nxt = qidSafe<HTMLButtonElement>('statsWeekNext');
      if (nxt) nxt.disabled = false;
    }

    this.renderDayBars(weekW, mon);
    this.filterWorkoutList(weekW);
  }

  /** Render day bars inside the stats detail section */
  private renderDayBars(weekW: Workout[], mon: Date): void {
    const el = qidSafe<HTMLElement>('statsDetailBars');
    if (!el) return;

    const km: number[]     = Array(7).fill(0);
    const types: string[]  = Array(7).fill('none');
    const dates: number[]  = Array(7).fill(0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      dates[i] = d.getDate();
    }

    weekW.forEach(w => {
      const i = Math.floor((new Date(w.date).getTime() - mon.getTime()) / 86_400_000);
      if (i >= 0 && i < 7) {
        km[i]    += w.distance;
        types[i]  = w.type;
      }
    });

    const max = Math.max(...km, 0.1);

    el.innerHTML = DAY_NAMES.map((name, i) => {
      const h   = Math.round((km[i] / max) * 48);
      const col = TYPE_COLOR[types[i] as WorkoutType] ?? '#3a4147';
      const act = this.state.selectedDay === i ? ' active' : '';
      const bar = `style="height:${Math.max(h, km[i] > 0 ? 4 : 2)}px;background:${col}"`;
      return `<div class="stats-detail__day-col${act}" data-day="${i}">
        <div class="stats-detail__bar" ${bar}></div>
        <div class="stats-detail__day-name">${name}</div>
        <div class="stats-detail__day-date">${dates[i]}</div>
      </div>`;
    }).join('');

    el.querySelectorAll<HTMLElement>('.stats-detail__day-col').forEach(col => {
      col.addEventListener('click', e => {
        e.stopPropagation();
        const day = Number(col.dataset.day);
        this.state.selectedDay = this.state.selectedDay === day ? null : day;
        this.render();
      });
    });
  }

  /** Hide workout cards not in the current week */
  private filterWorkoutList(weekW: Workout[]): void {
    const ids = new Set(weekW.map(w => w.id));
    document.querySelectorAll<HTMLElement>('.workout').forEach(el => {
      el.style.display = ids.has(el.dataset.id ?? '') ? '' : 'none';
    });
  }

  private getWeekWorkouts(): Workout[] {
    const { mon, sun } = getWeekBounds(this.state.weekOffset);
    return this.workouts.filter(w => {
      const d = new Date(w.date);
      return d >= mon && d <= sun;
    });
  }

  /** Wire up all event listeners — call once after DOM is ready */
  init(): void {
    const panel  = qidSafe('statsPanel');
    const detail = qidSafe('statsDetail');
    const editor = qidSafe('statsGoalEditor');
    const prev   = qidSafe<HTMLButtonElement>('statsWeekPrev');
    const next   = qidSafe<HTMLButtonElement>('statsWeekNext');
    if (!panel) return;

    // Restore goal inputs
    const setInputVal = (id: string, val: number) => {
      const el = qidSafe<HTMLInputElement>(id);
      if (el) el.value = String(val);
    };
    setInputVal('goalKmInput',    this.state.goalKm);
    setInputVal('goalTimeInput',  this.state.goalTime);
    setInputVal('goalCountInput', this.state.goalCount);

    // Expand / collapse
    panel.addEventListener('click', () => {
      this.state.expanded = !this.state.expanded;
      detail?.classList.toggle('hidden', !this.state.expanded);
      editor?.classList.toggle('hidden', !this.state.expanded);
      const scroll = document.querySelector<HTMLElement>('#tabStats .tab-scroll');
      if (scroll) scroll.style.overflowY = this.state.expanded ? 'auto' : '';
    });
    detail?.addEventListener('click', e => e.stopPropagation());
    editor?.addEventListener('click', e => e.stopPropagation());

    // Week navigation
    prev?.addEventListener('click', e => {
      e.stopPropagation();
      this.state.weekOffset--;
      this.state.selectedDay = null;
      if (next) next.disabled = false;
      this.render();
    });
    next?.addEventListener('click', e => {
      e.stopPropagation();
      if (this.state.weekOffset >= 0) return;
      this.state.weekOffset++;
      this.state.selectedDay = null;
      if (this.state.weekOffset === 0 && next) next.disabled = true;
      this.render();
    });

    // Goal editors
    const goalInput = (
      field: 'goalKm' | 'goalTime' | 'goalCount',
      key: string,
      id: string,
      fallback: number,
    ) => {
      qidSafe<HTMLInputElement>(id)?.addEventListener('change', e => {
        const val = Math.max(1, +(e.target as HTMLInputElement).value || fallback);
        this.state[field] = val;
        (e.target as HTMLInputElement).value = String(val);
        localStorage.setItem(key, String(val));
        this.render();
      });
    };
    goalInput('goalKm',    'goalKm',    'goalKmInput',    35);
    goalInput('goalTime',  'goalTime',  'goalTimeInput',  300);
    goalInput('goalCount', 'goalCount', 'goalCountInput', 7);
  }
}
