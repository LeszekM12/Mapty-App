'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
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

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

// Route elements
const btnRoute = document.getElementById('btnRoute');
const routeInfo = document.getElementById('routeInfo');
const btnCancelRoute = document.getElementById('btnCancelRoute');
const stepAText = document.getElementById('stepAText');
const stepBText = document.getElementById('stepBText');
const routeResult = document.getElementById('routeResult');
const routeDist = document.getElementById('routeDist');
const routeTime = document.getElementById('routeTime');
const routeLoading = document.getElementById('routeLoading');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  // Route state
  #routeMode = false;
  #routeStep = 0; // 0=idle, 1=waiting for A, 2=waiting for B
  #routePointA = null;
  #routePointB = null;
  #routingControl = null;
  #routeMarkerA = null;
  #routeMarkerB = null;
  #routeActivityMode = 'running'; // 'running' | 'cycling' | 'walking'

  // Średnie prędkości w km/h do przeliczania czasu
  #activitySpeeds = {
    running: 10,   // ~6 min/km
    cycling: 20,   // typowy rower rekreacyjny
    walking: 5,    // ~12 min/km
  };

  constructor() {
    this._getPosition();
    this._getLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // Route button listeners
    btnRoute.addEventListener('click', this._startRouteMode.bind(this));
    btnCancelRoute.addEventListener('click', this._cancelRoute.bind(this));

    // Activity mode buttons
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
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._handleMapClick.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  // Unified map click handler
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
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

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

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
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
  }

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

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    if (!this.#map) return;
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  // ─── ROUTING FEATURE ────────────────────────────────────────────

  _setActivityMode(e) {
    const btn = e.currentTarget;
    const mode = btn.dataset.mode;
    this.#routeActivityMode = mode;

    // Aktualizuj aktywny przycisk
    document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('route-mode-btn--active'));
    btn.classList.add('route-mode-btn--active');

    // Jeśli trasa już wyznaczona — przelicz czas na nowo
    if (this.#routeStep === 3 && !routeResult.classList.contains('hidden')) {
      const distKm = parseFloat(routeDist.textContent);
      if (!isNaN(distKm)) {
        const speed = this.#activitySpeeds[mode];
        const timeMin = Math.round((distKm / speed) * 60);
        routeTime.textContent = timeMin;
      }
    }
  }

  _startRouteMode() {
    // Hide workout form if open
    if (!form.classList.contains('hidden')) this._hideForm();

    this.#routeMode = true;
    this.#routeStep = 1;
    this.#routePointA = null;
    this.#routePointB = null;

    btnRoute.classList.add('hidden');
    routeInfo.classList.remove('hidden');
    routeResult.classList.add('hidden');

    stepAText.textContent = 'Kliknij punkt startowy na mapie';
    stepBText.textContent = 'Kliknij punkt końcowy na mapie';
    stepAText.closest('.route-info__step').classList.remove('route-info__step--done');
    stepBText.closest('.route-info__step').classList.remove('route-info__step--done');

    document.getElementById('map').style.cursor = 'crosshair';
  }

  _handleRouteClick(mapE) {
    const { lat, lng } = mapE.latlng;

    if (this.#routeStep === 1) {
      // Set point A
      this.#routePointA = [lat, lng];
      this.#routeStep = 2;

      // Place marker A
      if (this.#routeMarkerA) this.#map.removeLayer(this.#routeMarkerA);
      this.#routeMarkerA = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="route-marker route-marker--a">A</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(this.#map);

      stepAText.textContent = 'Punkt startowy ustawiony ✓';
      stepAText.closest('.route-info__step').classList.add('route-info__step--done');
      stepBText.textContent = 'Kliknij punkt końcowy na mapie';

    } else if (this.#routeStep === 2) {
      // Set point B
      this.#routePointB = [lat, lng];
      this.#routeStep = 3;

      // Place marker B
      if (this.#routeMarkerB) this.#map.removeLayer(this.#routeMarkerB);
      this.#routeMarkerB = L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="route-marker route-marker--b">B</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(this.#map);

      stepBText.textContent = 'Punkt końcowy ustawiony ✓';
      stepBText.closest('.route-info__step').classList.add('route-info__step--done');

      document.getElementById('map').style.cursor = '';

      // Draw route
      this._drawRoute();
    }
  }

  _drawRoute() {
    // Pokaż loading, ukryj poprzedni wynik
    routeLoading.classList.remove('hidden');
    routeResult.classList.add('hidden');

    // Remove old routing control if exists
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
      show: false, // ukrywamy domyślny panel — mamy własny
      lineOptions: {
        styles: [{ color: '#00c46a', weight: 5, opacity: 0.85 }],
      },
      createMarker: () => null, // używamy własnych markerów A/B
    })
      .on('routesfound', e => {
        routeLoading.classList.add('hidden');
        const route = e.routes[0].summary;
        const distKm = (route.totalDistance / 1000).toFixed(2);

        // Przelicz czas na podstawie wybranej aktywności
        const speed = this.#activitySpeeds[this.#routeActivityMode];
        const timeMin = Math.round((parseFloat(distKm) / speed) * 60);

        routeDist.textContent = distKm;
        routeTime.textContent = timeMin;
        routeResult.classList.remove('hidden');
      })
      .on('routingerror', () => {
        routeLoading.classList.add('hidden');
        routeDist.textContent = 'Błąd';
        routeTime.textContent = '—';
        routeResult.classList.remove('hidden');
      })
      .addTo(this.#map);
  }

  _cancelRoute() {
    this.#routeMode = false;
    this.#routeStep = 0;
    this.#routePointA = null;
    this.#routePointB = null;

    // Remove markers
    if (this.#routeMarkerA) { this.#map.removeLayer(this.#routeMarkerA); this.#routeMarkerA = null; }
    if (this.#routeMarkerB) { this.#map.removeLayer(this.#routeMarkerB); this.#routeMarkerB = null; }

    // Remove routing control
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

// ─── MOBILE PANEL DRAG ───────────────────────────────────────────
(function initMobilePanel() {
  const sidebar = document.querySelector('.sidebar');
  let startY = 0;
  let startHeight = 0;
  let isDragging = false;

  const isMobile = () => window.innerWidth <= 768;

  // Dotyk zaczyna się na uchwycie (::before nie można złapać, więc łapiemy górne 40px sidebara)
  sidebar.addEventListener('touchstart', e => {
    if (!isMobile()) return;
    const touch = e.touches[0];
    const rect = sidebar.getBoundingClientRect();
    // Tylko górne 48px sidebara = uchwyt
    if (touch.clientY - rect.top > 48) return;
    isDragging = true;
    startY = touch.clientY;
    startHeight = sidebar.offsetHeight;
    sidebar.style.transition = 'none';
  }, { passive: true });

  sidebar.addEventListener('touchmove', e => {
    if (!isDragging || !isMobile()) return;
    const touch = e.touches[0];
    const delta = startY - touch.clientY;
    const newHeight = Math.min(
      Math.max(startHeight + delta, 100), // min 100px
      window.innerHeight * 0.85           // max 85vh
    );
    sidebar.style.minHeight = newHeight + 'px';
  }, { passive: true });

  sidebar.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    sidebar.style.transition = '';

    const currentHeight = sidebar.offsetHeight;
    const vh = window.innerHeight;

    // Snap: jeśli poniżej 20vh — zwiń do minimum, powyżej 60vh — rozwiń do max
    if (currentHeight < vh * 0.20) {
      sidebar.style.minHeight = '13rem';
    } else if (currentHeight > vh * 0.60) {
      sidebar.style.minHeight = (vh * 0.85) + 'px';
    }
    // w środku — zostaw jak jest
  });
})();
