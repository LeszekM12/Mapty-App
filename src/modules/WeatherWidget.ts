// ─── WEATHER WIDGET ──────────────────────────────────────────────────────────
//
// MIGRATION EXAMPLE — Old JS vs New TS
// ─────────────────────────────────────
//
// OLD (script.js, ~30 lines, no types, all mixed into one IIFE):
// ─────────────────────────────────────────────────────────────
//   (function initWeather() {
//     const LAT = 54.09, LNG = 18.79;
//
//     function wmoToIcon(code) {          // no param type
//       if (code === 0) return '☀️';
//       if (code <= 2)  return '🌤️';
//       ...
//     }
//     function fmtSunset(isoStr) {        // no return type
//       if (!isoStr) return '—';
//       const d = new Date(isoStr);
//       return String(d.getHours()).padStart(2,'0') + ':' + ...
//     }
//     function render(icon, sunset) {     // any types, no safety
//       document.querySelectorAll('.weather-widget__icon')
//         .forEach(el => el.textContent = icon);
//       ...
//     }
//     async function fetch_weather(lat, lng) { // underscore naming
//       const res = await fetch(url);
//       const d   = await res.json();           // untyped response
//       render(wmoToIcon(d.current?.weathercode ?? 0), ...);
//     }
//     fetch_weather(LAT, LNG);
//     setInterval(() => fetch_weather(LAT, LNG), 30 * 60 * 1000);
//   })();
//
// NEW (WeatherWidget.ts):
// ────────────────────────
//   - OpenMeteoResponse interface = typed API shape
//   - WeatherData interface = typed render payload
//   - WMO_MAP constant = explicit lookup table with description
//   - Pure functions (wmoToWeather, formatSunset)
//   - Exported initWeatherWidget() = clear public API
//   - 30-min interval cleanup via returned disposer
//   - Coordinates optionally injected (dependency injection)
// ─────────────────────────────────────────────────────────────

import { Coords, WeatherData, OpenMeteoResponse } from '../types/index.js';

// ── WMO Weather Interpretation Code map ──────────────────────────────────────

interface WmoEntry {
  icon:        string;
  description: string;
}

const WMO_MAP: Record<string, WmoEntry> = {
  '0':       { icon: '☀️',  description: 'Clear sky' },
  '1':       { icon: '🌤️', description: 'Mainly clear' },
  '2':       { icon: '🌤️', description: 'Partly cloudy' },
  '3':       { icon: '☁️',  description: 'Overcast' },
  '45':      { icon: '🌫️', description: 'Fog' },
  '48':      { icon: '🌫️', description: 'Depositing rime fog' },
  '51':      { icon: '🌧️', description: 'Light drizzle' },
  '53':      { icon: '🌧️', description: 'Moderate drizzle' },
  '55':      { icon: '🌧️', description: 'Dense drizzle' },
  '61':      { icon: '🌧️', description: 'Slight rain' },
  '63':      { icon: '🌧️', description: 'Moderate rain' },
  '65':      { icon: '🌧️', description: 'Heavy rain' },
  '71':      { icon: '❄️',  description: 'Slight snow' },
  '73':      { icon: '❄️',  description: 'Moderate snow' },
  '75':      { icon: '❄️',  description: 'Heavy snow' },
  '77':      { icon: '🌨️', description: 'Snow grains' },
  '80':      { icon: '🌦️', description: 'Slight rain showers' },
  '81':      { icon: '🌦️', description: 'Moderate rain showers' },
  '82':      { icon: '🌦️', description: 'Violent rain showers' },
  '85':      { icon: '🌨️', description: 'Slight snow showers' },
  '86':      { icon: '🌨️', description: 'Heavy snow showers' },
  '95':      { icon: '⛈️',  description: 'Thunderstorm' },
  '96':      { icon: '⛈️',  description: 'Thunderstorm with slight hail' },
  '99':      { icon: '⛈️',  description: 'Thunderstorm with heavy hail' },
};

// ── Pure helper functions ─────────────────────────────────────────────────────

/** Map a WMO code to icon + description */
export function wmoToWeather(code: number): WmoEntry {
  // Exact match first
  if (WMO_MAP[String(code)]) return WMO_MAP[String(code)];
  // Range fallbacks
  if (code <= 2)  return WMO_MAP['2'];
  if (code <= 3)  return WMO_MAP['3'];
  if (code <= 48) return WMO_MAP['45'];
  if (code <= 55) return WMO_MAP['55'];
  if (code <= 65) return WMO_MAP['65'];
  if (code <= 77) return WMO_MAP['77'];
  if (code <= 82) return WMO_MAP['82'];
  if (code <= 86) return WMO_MAP['86'];
  return WMO_MAP['99'];
}

/** Format an ISO sunset string to "HH:MM" */
export function formatSunset(isoStr: string | undefined): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Fetch weather from Open-Meteo (free, no key) */
export async function fetchWeatherData(coords: Coords): Promise<WeatherData> {
  const [lat, lng] = coords;
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${lat}&longitude=${lng}`,
    '&current=weathercode',
    '&daily=sunset',
    '&timezone=auto',
    '&forecast_days=1',
  ].join('');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);

  const data = await res.json() as OpenMeteoResponse;
  const { icon } = wmoToWeather(data.current?.weathercode ?? 0);
  const sunset   = formatSunset(data.daily?.sunset?.[0]);

  return { icon, sunset };
}

// ── DOM render ────────────────────────────────────────────────────────────────

function renderWidget(data: WeatherData): void {
  document.querySelectorAll<HTMLElement>('.weather-widget__icon')
    .forEach(el => { el.textContent = data.icon; });
  document.querySelectorAll<HTMLElement>('.weather-widget__sun')
    .forEach(el => { el.textContent = `🌅 ${data.sunset}`; });
}

// ── Public API ────────────────────────────────────────────────────────────────

const DEFAULT_COORDS: Coords = [54.09, 18.79]; // Tczew area
const UPDATE_INTERVAL_MS     = 30 * 60 * 1000;  // 30 minutes

/** Kick off the weather widget. Optionally pass coordinates.
 *  Returns a disposer function that clears the update interval. */
export function initWeatherWidget(coords: Coords = DEFAULT_COORDS): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  async function update(): Promise<void> {
    try {
      const data = await fetchWeatherData(coords);
      renderWidget(data);
    } catch {
      // Fail silently — keep last rendered values
    }
  }

  // First fetch immediately
  void update();

  // Then repeat every 30 min
  intervalId = setInterval(() => void update(), UPDATE_INTERVAL_MS);

  // Return disposer for cleanup
  return () => {
    if (intervalId !== null) clearInterval(intervalId);
  };
}
