/* ===========================================================
   Atlas — deck.gl global cities network
   Loaded as a regular script after deck.gl/dist.min.js
   =========================================================== */
(() => {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') return fn();
    document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    const el = document.getElementById('atlasMap');
    if (!el) return;
    if (typeof deck === 'undefined') {
      console.warn('[atlas] deck.gl not loaded');
      return;
    }

    const {
      Deck,
      MapView,
      ScatterplotLayer,
      ArcLayer,
      LineLayer,
      TextLayer,
    } = deck;

    /* --- 50 cities (subset from Yap & Biljecki 2023, Global Feature-Rich Network) --- */
    const cities = [
      ['Singapore', 1.3521, 103.8198],
      ['Tokyo', 35.6762, 139.6503],
      ['Seoul', 37.5665, 126.9780],
      ['Beijing', 39.9042, 116.4074],
      ['Shanghai', 31.2304, 121.4737],
      ['Hong Kong', 22.3193, 114.1694],
      ['Bangkok', 13.7563, 100.5018],
      ['Kuala Lumpur', 3.1390, 101.6869],
      ['Jakarta', -6.2088, 106.8456],
      ['Manila', 14.5995, 120.9842],
      ['Mumbai', 19.0760, 72.8777],
      ['Delhi', 28.6139, 77.2090],
      ['Bengaluru', 12.9716, 77.5946],
      ['Dubai', 25.2048, 55.2708],
      ['Istanbul', 41.0082, 28.9784],
      ['Moscow', 55.7558, 37.6173],
      ['Berlin', 52.5200, 13.4050],
      ['Paris', 48.8566, 2.3522],
      ['London', 51.5074, -0.1278],
      ['Madrid', 40.4168, -3.7038],
      ['Barcelona', 41.3851, 2.1734],
      ['Rome', 41.9028, 12.4964],
      ['Vienna', 48.2082, 16.3738],
      ['Amsterdam', 52.3676, 4.9041],
      ['Stockholm', 59.3293, 18.0686],
      ['Copenhagen', 55.6761, 12.5683],
      ['Helsinki', 60.1699, 24.9384],
      ['Zurich', 47.3769, 8.5417],
      ['Athens', 37.9838, 23.7275],
      ['Cairo', 30.0444, 31.2357],
      ['Lagos', 6.5244, 3.3792],
      ['Cape Town', -33.9249, 18.4241],
      ['Nairobi', -1.2921, 36.8219],
      ['Buenos Aires', -34.6037, -58.3816],
      ['Sao Paulo', -23.5505, -46.6333],
      ['Rio de Janeiro', -22.9068, -43.1729],
      ['Lima', -12.0464, -77.0428],
      ['Mexico City', 19.4326, -99.1332],
      ['Santiago', -33.4489, -70.6693],
      ['Bogota', 4.7110, -74.0721],
      ['New York', 40.7128, -74.0060],
      ['Boston', 42.3601, -71.0589],
      ['Toronto', 43.6532, -79.3832],
      ['Chicago', 41.8781, -87.6298],
      ['Los Angeles', 34.0522, -118.2437],
      ['San Francisco', 37.7749, -122.4194],
      ['Vancouver', 49.2827, -123.1207],
      ['Sydney', -33.8688, 151.2093],
      ['Melbourne', -37.8136, 144.9631],
      ['Auckland', -36.8485, 174.7633],
    ];

    const points = cities.map(([name, lat, lon]) => ({ name, position: [lon, lat] }));

    // pick anchors (Singapore + Cornell Ithaca/NYC + London) and draw arcs to all
    const anchorNames = ['Singapore', 'New York', 'London'];
    const anchors = points.filter(p => anchorNames.includes(p.name));

    const arcs = [];
    for (const a of anchors) {
      for (const p of points) {
        if (p.name === a.name) continue;
        arcs.push({
          source: a.position,
          target: p.position,
          fromName: a.name,
          toName: p.name,
        });
      }
    }

    /* --- Color helpers --- */
    const COLOR_CYAN = [110, 224, 255];
    const COLOR_LILAC = [180, 156, 255];
    const COLOR_AMBER = [242, 179, 111];

    function arcColor(d) {
      if (d.fromName === 'Singapore') return COLOR_CYAN;
      if (d.fromName === 'New York') return COLOR_LILAC;
      return COLOR_AMBER;
    }

    /* --- Build deck instance --- */
    const initialViewState = {
      longitude: 20,
      latitude: 28,
      zoom: 1.4,
      pitch: 28,
      bearing: 0,
      maxZoom: 4,
      minZoom: 0.6,
    };

    let viewState = { ...initialViewState };

    const deckInstance = new Deck({
      parent: el,
      views: new MapView({ repeat: true }),
      viewState,
      controller: { dragRotate: true, scrollZoom: { speed: 0.01, smooth: true }, doubleClickZoom: true, touchRotate: true },
      onViewStateChange: ({ viewState: vs }) => {
        viewState = vs;
        deckInstance.setProps({ viewState });
      },
      onWebGLInitialized: (gl) => {
        gl.clearColor(0.02, 0.025, 0.04, 1);
      },
      layers: [],
    });

    /* --- Draw graticule + a coastline-ish backdrop using GeoJSON from CDN --- */
    // To keep this self-contained, render a simple sphere graticule via LineLayer
    const grats = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      grats.push({ source: [lon, -85], target: [lon, 85] });
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const ring = [];
      for (let lon = -180; lon <= 180; lon += 5) ring.push([lon, lat]);
      for (let i = 0; i < ring.length - 1; i++) {
        grats.push({ source: ring[i], target: ring[i+1] });
      }
    }

    /* Try to fetch a low-res world coastlines geojson; if it fails, just skip. */
    let basePolys = null;
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(geo => { basePolys = geo; rebuild(); })
      .catch(() => {});

    function rebuild() {
      const t = (performance.now() / 1000) % 4;
      const arcWidth = (d) => 1.4;

      const layers = [];

      if (basePolys && deck.GeoJsonLayer) {
        layers.push(new deck.GeoJsonLayer({
          id: 'world',
          data: basePolys,
          stroked: true,
          filled: true,
          pickable: false,
          getFillColor: [16, 20, 30, 200],
          getLineColor: [40, 50, 70, 220],
          lineWidthMinPixels: 0.6,
        }));
      }

      layers.push(new LineLayer({
        id: 'graticule',
        data: grats,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getColor: [60, 70, 92, 80],
        getWidth: 0.5,
      }));

      layers.push(new ArcLayer({
        id: 'arcs',
        data: arcs,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getSourceColor: d => [...arcColor(d), 220],
        getTargetColor: d => [...arcColor(d), 40],
        getWidth: arcWidth,
        greatCircle: true,
        getHeight: 0.6,
      }));

      layers.push(new ScatterplotLayer({
        id: 'cities-glow',
        data: points,
        getPosition: d => d.position,
        getRadius: 60000,
        radiusUnits: 'meters',
        getFillColor: [110, 224, 255, 60],
        radiusMinPixels: 6,
        radiusMaxPixels: 18,
        stroked: false,
      }));

      layers.push(new ScatterplotLayer({
        id: 'cities',
        data: points,
        getPosition: d => d.position,
        getRadius: 28000,
        radiusUnits: 'meters',
        getFillColor: d => anchorNames.includes(d.name) ? [255, 255, 255, 240] : [110, 224, 255, 230],
        getLineColor: [255, 255, 255, 120],
        lineWidthMinPixels: 0.5,
        radiusMinPixels: 2.6,
        radiusMaxPixels: 6,
        stroked: true,
        pickable: true,
      }));

      layers.push(new TextLayer({
        id: 'labels',
        data: points,
        getPosition: d => d.position,
        getText: d => d.name,
        getSize: 11,
        getColor: [220, 226, 240, 220],
        getPixelOffset: [10, -8],
        getTextAnchor: 'start',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 400,
        fontSettings: { sdf: true, smoothing: 0.12 },
        outlineColor: [4, 6, 12, 220],
        outlineWidth: 3,
        billboard: false,
      }));

      deckInstance.setProps({ layers });
    }

    // initial build (without polys)
    rebuild();

    // Slow auto-spin via bearing to give it life until user interacts
    let userTouched = false;
    let last = performance.now();
    el.addEventListener('pointerdown', () => { userTouched = true; });
    el.addEventListener('wheel', () => { userTouched = true; }, { passive: true });

    function spin() {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      if (!userTouched) {
        viewState = { ...viewState, bearing: (viewState.bearing + dt * 4) % 360 };
        deckInstance.setProps({ viewState });
      }
      requestAnimationFrame(spin);
    }
    requestAnimationFrame(spin);

    // Pause when offscreen (perf)
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) {
          // nothing — deck already pauses internal redraws when nothing changes
        }
      }
    }, { threshold: 0.01 });
    io.observe(el);
  });
})();
