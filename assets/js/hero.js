/* ===========================================================
   Hero — deck.gl TripsLayer over MapLibre (NYC dark-matter)
   Adapted from the official deck.gl /examples/website/trips
   =========================================================== */
(() => {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') return fn();
    document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    const el = document.getElementById('heroMap');
    if (!el) return;
    if (typeof maplibregl === 'undefined') { console.warn('[hero] maplibre-gl missing'); return; }
    if (typeof deck === 'undefined') { console.warn('[hero] deck.gl missing'); return; }

    const {
      MapboxOverlay,
      TripsLayer,
      PolygonLayer,
      AmbientLight, PointLight, LightingEffect
    } = deck;

    if (!MapboxOverlay) { console.warn('[hero] MapboxOverlay missing — load @deck.gl/mapbox'); return; }
    if (!TripsLayer)   { console.warn('[hero] TripsLayer missing — load @deck.gl/geo-layers'); return; }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* --- Lighting (matches the deck.gl trips example) --- */
    const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 1.0 });
    const pointLight   = new PointLight({   color: [255, 255, 255], intensity: 2.0, position: [-74.05, 40.7, 8000] });
    const lightingEffect = new LightingEffect({ ambientLight, pointLight });

    const theme = {
      buildingColor: [74, 80, 87],
      trailColor0:   [253, 128, 93],
      trailColor1:   [23, 184, 190],
      material: { ambient: 0.1, diffuse: 0.6, shininess: 32, specularColor: [60, 64, 70] }
    };

    /* --- MapLibre map (Carto dark-matter-nolabels) --- */
    const map = new maplibregl.Map({
      container: el,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
      center: [-74.0045, 40.7205],   // lower Manhattan, where the trips converge
      zoom: 14.6,                    // closer — buildings clearly readable
      pitch: 56,                     // dramatic perspective
      bearing: 0,
      interactive: false,             // backdrop only — don't hijack page scroll
      attributionControl: false,
    });

    // Add a low-key attribution control
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    /* --- Scroll-driven bearing rotation ---
       1° per ~6px of scroll → ~60° rotation per typical hero scroll. */
    const SCROLL_TO_DEG = 1 / 6;
    let pendingScroll = false;
    function onScroll() {
      if (pendingScroll) return;
      pendingScroll = true;
      requestAnimationFrame(() => {
        const sY = window.scrollY || (document.documentElement && document.documentElement.scrollTop) || 0;
        if (map && map.loaded()) {
          map.setBearing((sY * SCROLL_TO_DEG) % 360);
        }
        pendingScroll = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // Hook Lenis as well (it dispatches its own scroll events through window, but this is belt-and-suspenders)
    if (window.__lenis) {
      const lenis = window.__lenis();
      if (lenis && typeof lenis.on === 'function') {
        lenis.on('scroll', onScroll);
      }
    }

    const overlay = new MapboxOverlay({
      interleaved: false,
      effects: [lightingEffect],
      layers: [],
    });

    map.on('load', () => {
      map.addControl(overlay);

      Promise.all([
        fetch('https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/buildings.json').then(r => r.json()),
        fetch('https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/trips-v7.json').then(r => r.json()),
      ]).then(([buildings, trips]) => {
        const trailLength    = 180;
        const loopLength     = 1800;
        const animationSpeed = reduceMotion ? 0 : 2;   // a touch faster than the example for hero impact

        // Pause animation when hero is off-screen
        let visible = true;
        const io = new IntersectionObserver((entries) => {
          for (const e of entries) visible = e.isIntersecting;
        }, { threshold: 0.01 });
        io.observe(el);

        const start = performance.now();
        function frame() {
          if (visible) {
            const elapsed = (performance.now() - start) / 1000;
            const time = (elapsed * 60 * animationSpeed) % loopLength;
            overlay.setProps({
              layers: [
                new TripsLayer({
                  id: 'trips',
                  data: trips,
                  getPath: d => d.path,
                  getTimestamps: d => d.timestamps,
                  getColor: d => (d.vendor === 0 ? theme.trailColor0 : theme.trailColor1),
                  opacity: 0.65,
                  widthMinPixels: 2.4,
                  rounded: true,
                  trailLength,
                  currentTime: time,
                  shadowEnabled: false,
                }),
                new PolygonLayer({
                  id: 'buildings',
                  data: buildings,
                  extruded: true,
                  wireframe: false,
                  opacity: 0.55,
                  getPolygon: f => f.polygon,
                  getElevation: f => f.height,
                  getFillColor: theme.buildingColor,
                  material: theme.material,
                })
              ]
            });
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }).catch(err => {
        console.warn('[hero] failed to load trips data', err);
      });
    });
  });
})();
