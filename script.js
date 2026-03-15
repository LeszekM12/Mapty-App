'use strict';

// ─── WORKOUT BASE CLASS ──────────────────────────────────────────
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords;   // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

// ─── RUNNING CHILD CLASS ─────────────────────────────────────────
class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

// ─── CYCLING CHILD CLASS ─────────────────────────────────────────
class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE

// Form & input DOM elements
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// Route planner DOM elements
const btnRoute = document.getElementById('btnRoute');
const routeInfo = document.getElementById('routeInfo');
const btnCancelRoute = document.getElementById('btnCancelRoute');
const stepAText = document.getElementById('stepAText');
const stepBText = document.getElementById('stepBText');
const routeResult = document.getElementById('routeResult');
const routeDist = document.getElementById('routeDist');
const routeTime = document.getElementById('routeTime');
const routeLoading = document.getElementById('routeLoading');

// ─── MAIN APP CLASS ──────────────────────────────────────────────
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  // Route planner state
  #routeMode = false;
  #routeStep = 0; // 0=idle, 1=waiting for point A, 2=waiting for point B, 3=route drawn
  #routePointA = null;
  #routePointB = null;
  #routingControl = null;
  #routeMarkerA = null;
  #routeMarkerB = null;
  #routeActivityMode = 'running'; // 'running' | 'cycling' | 'walking'

  // Stores Leaflet marker references by workout id — enables individual deletion
  #markers = new Map();

  // Average speeds (km/h) used to calculate estimated route time per activity
  #activitySpeeds = {
    running: 10,  // ~6 min/km
    cycling: 20,  // recreational pace
    walking: 5,   // ~12 min/km
  };

  constructor() {
    // Initialise map at user's current position
    this._getPosition();

    // Restore workouts from localStorage
    this._getLocalStorage();

    // Event listeners
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // Route planner buttons
    btnRoute.addEventListener('click', this._startRouteMode.bind(this));
    btnCancelRoute.addEventListener('click', this._cancelRoute.bind(this));

    // Activity mode selector buttons (running / cycling / walking)
    document.querySelectorAll('.route-mode-btn').forEach(btn => {
      btn.addEventListener('click', this._setActivityMode.bind(this));
    });
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Single unified click handler — delegates to form or route planner
    this.#map.on('click', this._handleMapClick.bind(this));

    // Re-render markers for workouts loaded from localStorage
    this.#workouts.forEach(work => this._renderWorkoutMarker(work));
  }

  // ─── MAP CLICK HANDLER ───────────────────────────────────────────
  // Routes the click to either the workout form or the route planner
  _handleMapClick(mapE) {
    if (this.#routeMode) {
      this._handleRouteClick(mapE);
    } else {
      this._showForm(mapE);
    }
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();

    // On mobile — auto-expand the sidebar panel so the form is fully visible
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      // Wait one frame for the form to render before measuring actual scrollHeight
      requestAnimationFrame(() => {
        sidebar.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)';
        const needed = sidebar.scrollHeight;
        const minH = window.innerHeight * 0.55; // at least 55vh so form is never clipped
        const maxH = window.innerHeight * 0.85;
        sidebar.style.height = Math.min(Math.max(needed, minH), maxH) + 'px';
      });
    }
  }

  _hideForm() {
    // Clear all input fields
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);

    // On mobile — return sidebar to half height after adding a workout
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.sidebar');
      sidebar.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)';
      sidebar.style.height = '55vh';
    }
  }

  _toggleElevationField() {
    // Swap between cadence (running) and elevation (cycling) input
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // ─── CREATE NEW WORKOUT ──────────────────────────────────────────
  _newWorkout(e) {
    const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
        return alert('Inputs have to be positive numbers!');
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);
    this._renderWorkoutMarker(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();
  }

  // ─── RENDER MARKER ON MAP ────────────────────────────────────────
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
      .openPopup();

    // Store reference so the marker can be removed when workout is deleted
    this.#markers.set(workout.id, marker);
  }

  // ─── RENDER WORKOUT IN SIDEBAR LIST ─────────────────────────────
  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>`;

    // Inject delete button before closing </li>
    html = html.replace('</li>', `
        <button class="workout__delete" data-id="${workout.id}" title="Delete workout">✕</button>
      </li>`);

    form.insertAdjacentHTML('afterend', html);
  }

  // ─── SIDEBAR LIST CLICK HANDLER ──────────────────────────────────
  _moveToPopup(e) {
    if (!this.#map) return;

    // Check for delete button FIRST — before closest('.workout') captures the event
    const deleteBtn = e.target.closest('.workout__delete');
    if (deleteBtn) {
      e.stopPropagation();
      this._deleteWorkout(deleteBtn.dataset.id);
      return;
    }

    // Click on workout card — fly to its map location
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
    if (!workout) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  // ─── DELETE WORKOUT ──────────────────────────────────────────────
  _deleteWorkout(id) {
    // Remove marker from the map
    const marker = this.#markers.get(id);
    if (marker) {
      this.#map.removeLayer(marker);
      this.#markers.delete(id);
    }

    // Remove from workouts array
    this.#workouts = this.#workouts.filter(w => w.id !== id);

    // Animate out then remove from DOM
    const el = document.querySelector(`.workout[data-id="${id}"]`);
    if (el) {
      el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      el.style.transform = 'translateX(-110%)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }

    // Persist updated list
    this._setLocalStorage();
  }

  // ─── LOCAL STORAGE ───────────────────────────────────────────────
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  // ─── ROUTE PLANNER ───────────────────────────────────────────────

  // Update active activity mode button and recalculate time if route is already drawn
  _setActivityMode(e) {
    const btn = e.currentTarget;
    const mode = btn.dataset.mode;
    this.#routeActivityMode = mode;

    // Highlight selected button
    document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('route-mode-btn--active'));
    btn.classList.add('route-mode-btn--active');

    // If a route is already shown — recalculate time without re-fetching the route
    if (this.#routeStep === 3 && !routeResult.classList.contains('hidden')) {
      const distKm = parseFloat(routeDist.textContent);
      if (!isNaN(distKm)) {
        const speed = this.#activitySpeeds[mode];
        const timeMin = Math.round((distKm / speed) * 60);
        routeTime.textContent = timeMin;
      }
    }
  }

  // Enter route planning mode — next two map clicks set point A and point B
  _startRouteMode() {
    // Close workout form if it's open
    if (!form.classList.contains('hidden')) this._hideForm();

    this.#routeMode = true;
    this.#routeStep = 1;
    this.#routePointA = null;
    this.#routePointB = null;

    btnRoute.classList.add('hidden');
    routeInfo.classList.remove('hidden');
    routeResult.classList.add('hidden');

    // Reset step indicators
    stepAText.textContent = 'Click the start point on the map';
    stepBText.textContent = 'Click the end point on the map';
    stepAText.closest('.route-info__step').classList.remove('route-info__step--done');
    stepBText.closest('.route-info__step').classList.remove('route-info__step--done');

    document.getElementById('map').style.cursor = 'crosshair';
  }

  _handleRouteClick(mapE) {
    const { lat, lng } = mapE.latlng;

    if (this.#routeStep === 1) {
      // First click — set starting point A
      this.#routePointA = [lat, lng];
      this.#routeStep = 2;

      if (this.#routeMarkerA) this.#map.removeLayer(this.#routeMarkerA);
      this.#routeMarkerA = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="route-marker route-marker--a">A</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(this.#map);

      stepAText.textContent = 'Start point set ✓';
      stepAText.closest('.route-info__step').classList.add('route-info__step--done');
      stepBText.textContent = 'Click the end point on the map';

    } else if (this.#routeStep === 2) {
      // Second click — set destination point B and draw route
      this.#routePointB = [lat, lng];
      this.#routeStep = 3;

      if (this.#routeMarkerB) this.#map.removeLayer(this.#routeMarkerB);
      this.#routeMarkerB = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="route-marker route-marker--b">B</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(this.#map);

      stepBText.textContent = 'End point set ✓';
      stepBText.closest('.route-info__step').classList.add('route-info__step--done');

      document.getElementById('map').style.cursor = '';

      this._drawRoute();
    }
  }

  _drawRoute() {
    // Show loading indicator, hide any previous result
    routeLoading.classList.remove('hidden');
    routeResult.classList.add('hidden');

    // Remove previous routing control if one exists
    if (this.#routingControl) {
      this.#map.removeControl(this.#routingControl);
      this.#routingControl = null;
    }

    this.#routingControl = L.Routing.control({
      waypoints: [
        L.latLng(this.#routePointA[0], this.#routePointA[1]),
        L.latLng(this.#routePointB[0], this.#routePointB[1]),
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false, // hide default Leaflet Routing Machine panel — we use our own
      lineOptions: {
        styles: [{ color: '#00c46a', weight: 5, opacity: 0.85 }],
      },
      createMarker: () => null, // suppress default waypoint markers — we use custom A/B markers
    })
      .on('routesfound', e => {
        routeLoading.classList.add('hidden');
        const route = e.routes[0].summary;
        const distKm = (route.totalDistance / 1000).toFixed(2);

        // Calculate time based on selected activity speed, not the OSRM car estimate
        const speed = this.#activitySpeeds[this.#routeActivityMode];
        const timeMin = Math.round((parseFloat(distKm) / speed) * 60);

        routeDist.textContent = distKm;
        routeTime.textContent = timeMin;
        routeResult.classList.remove('hidden');
      })
      .on('routingerror', () => {
        routeLoading.classList.add('hidden');
        routeDist.textContent = 'Error';
        routeTime.textContent = '—';
        routeResult.classList.remove('hidden');
      })
      .addTo(this.#map);
  }

  // Cancel route mode — clean up all markers, routing control and UI state
  _cancelRoute() {
    this.#routeMode = false;
    this.#routeStep = 0;
    this.#routePointA = null;
    this.#routePointB = null;

    if (this.#routeMarkerA) { this.#map.removeLayer(this.#routeMarkerA); this.#routeMarkerA = null; }
    if (this.#routeMarkerB) { this.#map.removeLayer(this.#routeMarkerB); this.#routeMarkerB = null; }

    if (this.#routingControl) {
      this.#map.removeControl(this.#routingControl);
      this.#routingControl = null;
    }

    routeLoading.classList.add('hidden');
    btnRoute.classList.remove('hidden');
    routeInfo.classList.add('hidden');
    routeResult.classList.add('hidden');
    document.getElementById('map').style.cursor = '';
  }
}

const app = new App();

// ─── MOBILE SLIDING PANEL ────────────────────────────────────────
// Sidebar behaves as a bottom sheet on mobile (like Google Maps / Strava)
// Drag the handle to expand or collapse; snaps to 3 positions
(function initMobilePanel() {
  const sidebar = document.querySelector('.sidebar');
  const HANDLE_ZONE = 56; // px from top of sidebar treated as the drag handle

  let startY = 0;
  let startHeight = 0;
  let isDragging = false;

  const isMobile = () => window.innerWidth <= 768;

  // Snap to a specific height with transition
  const snapTo = h => {
    sidebar.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1)';
    sidebar.style.height = h;
  };

  const collapse = () => snapTo('5.5rem'); // handle only — map fully visible
  const toHalf   = () => snapTo('55vh');   // half screen — enough room for workouts
  const toFull   = () => snapTo('85vh');   // nearly full screen

  // Start at half height on mobile (panel visible but map accessible)
  if (isMobile()) toHalf();

  window.addEventListener('resize', () => {
    if (!isMobile()) { sidebar.style.height = ''; sidebar.style.transition = ''; }
    else toHalf();
  });

  // Begin drag only when touch starts within the handle zone
  sidebar.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    const touch = e.touches[0];
    const rect = sidebar.getBoundingClientRect();
    if (touch.clientY - rect.top > HANDLE_ZONE) return;
    isDragging = true;
    startY = touch.clientY;
    startHeight = sidebar.offsetHeight;
    sidebar.style.transition = 'none';
  }, { passive: true });

  // Follow finger while dragging
  sidebar.addEventListener('touchmove', e => {
    if (!isDragging || !isMobile()) return;
    const touch = e.touches[0];
    const delta = startY - touch.clientY;
    const newH = Math.min(Math.max(startHeight + delta, 50), window.innerHeight * 0.88);
    sidebar.style.height = newH + 'px';
  }, { passive: true });

  // On release — snap to nearest position
  sidebar.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const h = sidebar.offsetHeight;
    const vh = window.innerHeight;
    if      (h < vh * 0.18) collapse();
    else if (h < vh * 0.65) toHalf();
    else                     toFull();
  });
})();
