/* ===========================================================
   Digital Twin — three.js procedural city + dark matter cloud
   ES Module (loaded via importmap)
   =========================================================== */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('twinCanvas');
if (canvas) {
  init(canvas);
}

function init(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = canvas.parentElement;

  /* --- renderer / scene / camera --- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x05060A, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060A, 0.018);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 800);
  camera.position.set(70, 56, 70);

  /* --- lights --- */
  const ambient = new THREE.AmbientLight(0x6E80FF, 0.35);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0x9FD8FF, 0.75);
  keyLight.position.set(40, 80, 30);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xB49CFF, 0.6);
  rimLight.position.set(-50, 30, -30);
  scene.add(rimLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(200, 64),
    new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.95, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  scene.add(ground);

  /* --- a faint grid floor for "data" feel --- */
  const grid = new THREE.GridHelper(180, 60, 0x1a2030, 0x10141c);
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  grid.position.y = 0.001;
  scene.add(grid);

  /* --- procedural city --- */
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);

  const tileSize = 60;
  const blockCount = 14;
  const cell = tileSize / blockCount;
  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x10131a,
    roughness: 0.55,
    metalness: 0.25,
    emissive: 0x0a0d14,
    flatShading: true,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x6EE0FF, transparent: true, opacity: 0.55,
  });

  // Pseudo-random with seed for consistency
  let seed = 137;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  // Ridge-ish noise via FBM-lite for realistic skyline
  function height(x, z) {
    const dx = x - blockCount/2;
    const dz = z - blockCount/2;
    const dist = Math.sqrt(dx*dx + dz*dz) / (blockCount/2);
    const radial = Math.max(0, 1 - dist*0.85);
    const n = (Math.sin(x*0.61 + z*0.34) + Math.cos(x*0.27 - z*0.51)) * 0.5 + 0.5;
    const r = rand();
    const v = (radial * 0.7) + (n * 0.4) + (r * 0.4);
    return Math.max(0.6, v * 14 + r * 4);
  }

  const buildings = [];
  for (let i = 0; i < blockCount; i++) {
    for (let j = 0; j < blockCount; j++) {
      // skip a few cells for streets/plazas
      if (rand() < 0.12) continue;
      const h = height(i, j);
      const w = cell * (0.55 + rand() * 0.35);
      const d = cell * (0.55 + rand() * 0.35);
      const geo = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
      const m = new THREE.Mesh(geo, buildingMaterial);
      const x = (i - blockCount/2) * cell + (rand()-0.5) * cell*0.1;
      const z = (j - blockCount/2) * cell + (rand()-0.5) * cell*0.1;
      m.position.set(x, h/2, z);
      cityGroup.add(m);
      buildings.push({ mesh: m, x, z, h });

      // edges for the architectural look
      const edges = new THREE.EdgesGeometry(geo);
      const lineSeg = new THREE.LineSegments(edges, edgeMaterial);
      lineSeg.position.copy(m.position);
      cityGroup.add(lineSeg);
    }
  }

  /* --- Network edges (graph) connecting nearby buildings --- */
  const linePositions = [];
  const lineColors = [];
  const cyan = new THREE.Color(0x6EE0FF);
  const lilac = new THREE.Color(0xB49CFF);
  for (let i = 0; i < buildings.length; i++) {
    const a = buildings[i];
    // connect to up to 2 nearest neighbors
    const dists = buildings
      .map((b, k) => ({ k, d: (b.x - a.x)**2 + (b.z - a.z)**2 }))
      .filter(o => o.k !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const o of dists) {
      const b = buildings[o.k];
      // skip very long links and those too far
      if (o.d > (cell * 2.4)**2) continue;
      const yA = a.h + 0.4;
      const yB = b.h + 0.4;
      linePositions.push(a.x, yA, a.z, b.x, yB, b.z);
      const c = (i + o.k) % 3 === 0 ? lilac : cyan;
      lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  const netGeo = new THREE.BufferGeometry();
  netGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  netGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const netMat = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.55,
  });
  const network = new THREE.LineSegments(netGeo, netMat);
  scene.add(network);

  /* --- Glowing node markers at building tops --- */
  const nodeGeo = new THREE.BufferGeometry();
  const nodePositions = [];
  for (const b of buildings) nodePositions.push(b.x, b.h + 0.4, b.z);
  nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  const nodeMat = new THREE.PointsMaterial({
    color: 0x6EE0FF,
    size: 1.2,
    transparent: true, opacity: 0.9,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const nodes = new THREE.Points(nodeGeo, nodeMat);
  scene.add(nodes);

  /* --- DARK MATTER particle cloud --- */
  // A spherical cloud of points using a custom shader for soft glow + flow.
  const PCOUNT = reduceMotion ? 1500 : 6000;
  const pPositions = new Float32Array(PCOUNT * 3);
  const pSeeds = new Float32Array(PCOUNT);
  const pColors = new Float32Array(PCOUNT * 3);
  const palette = [
    new THREE.Color(0x6EE0FF),
    new THREE.Color(0xB49CFF),
    new THREE.Color(0xF2B36F),
    new THREE.Color(0xFFFFFF),
  ];
  for (let i = 0; i < PCOUNT; i++) {
    // sphere shell of ~120 radius
    const r = 70 + Math.pow(Math.random(), 2.2) * 90;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pPositions[i*3+0] = r * Math.sin(phi) * Math.cos(theta);
    pPositions[i*3+1] = r * Math.cos(phi) * 0.6 + 8;
    pPositions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
    pSeeds[i] = Math.random();
    const c = palette[Math.floor(Math.random() * palette.length)];
    pColors[i*3+0] = c.r;
    pColors[i*3+1] = c.g;
    pColors[i*3+2] = c.b;
  }
  const dmGeo = new THREE.BufferGeometry();
  dmGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  dmGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeeds, 1));
  dmGeo.setAttribute('aColor', new THREE.BufferAttribute(pColors, 3));

  const dmMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: renderer.getPixelRatio() },
      uSize:  { value: 2.4 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vSeed;
      uniform float uTime;
      uniform float uPixel;
      uniform float uSize;
      void main() {
        vSeed = aSeed;
        vColor = aColor;
        // gentle curl-like swirl around Y axis with Z drift
        float t = uTime * 0.05;
        float a = aSeed * 6.2831853;
        vec3 p = position;
        float swirl = sin(t + a + p.y * 0.01) * 0.6;
        float c = cos(swirl), s = sin(swirl);
        mat2 R = mat2(c, -s, s, c);
        p.xz = R * p.xz;
        p.y += sin(t * 1.4 + a) * 1.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPixel * (220.0 / -mv.z) * (0.4 + aSeed * 0.9);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vSeed;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        float halo = pow(core, 2.0);
        float flick = 0.85 + 0.15 * sin(vSeed * 30.0);
        gl_FragColor = vec4(vColor * (core * 0.85 + halo * 0.6) * flick, halo * 0.95);
      }
    `,
  });

  const darkMatter = new THREE.Points(dmGeo, dmMat);
  scene.add(darkMatter);

  /* --- Subtle starfield (depth) --- */
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(800 * 3);
  for (let i = 0; i < 800; i++) {
    starPos[i*3+0] = (Math.random()-0.5) * 600;
    starPos[i*3+1] = (Math.random()) * 240 - 30;
    starPos[i*3+2] = (Math.random()-0.5) * 600;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xa8b3d0, size: 0.7, transparent: true, opacity: 0.55,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(stars);

  /* --- Controls --- */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 36;
  controls.maxDistance = 180;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.45;
  controls.target.set(0, 6, 0);
  // Wheel handled by Lenis on the page; disable wheel zoom inside canvas to avoid jumps,
  // we still keep pinch-to-zoom and right-click drag.
  controls.enableZoom = true;
  // prevent canvas wheel events from being absorbed entirely
  canvas.addEventListener('wheel', (e) => {
    // allow zoom only when alt/cmd held; otherwise let page scroll
    if (!(e.altKey || e.metaKey || e.ctrlKey)) {
      // do nothing — let it bubble for Lenis
    }
  }, { passive: true });
  // Stop autorotate when user interacts
  let userInteracted = false;
  controls.addEventListener('start', () => { controls.autoRotate = false; userInteracted = true; });
  controls.addEventListener('end', () => {
    setTimeout(() => { if (!userInteracted) controls.autoRotate = !reduceMotion; }, 2000);
  });

  /* --- Postprocessing (bloom) --- */
  let composer = null;
  let bloom = null;
  function buildComposer() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.85, 0.18);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  buildComposer();

  /* --- Resize --- */
  function resize() {
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    dmMat.uniforms.uPixel.value = renderer.getPixelRatio();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(wrap);
  window.addEventListener('resize', resize);

  /* --- HUD --- */
  const hudVerts = document.getElementById('hudVerts');
  const hudFrame = document.getElementById('hudFrame');
  if (hudVerts) {
    let total = 0;
    scene.traverse((o) => {
      if (o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        total += o.geometry.attributes.position.count;
      }
    });
    hudVerts.textContent = total.toLocaleString();
  }

  /* --- Animation loop with visibility-based throttling --- */
  let frameCount = 0;
  let lastFpsUpdate = performance.now();
  let fps = 60;
  let visible = true;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) visible = e.isIntersecting;
  }, { threshold: 0.05 });
  io.observe(canvas);

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();
    dmMat.uniforms.uTime.value = t;
    // gently float city on water
    cityGroup.position.y = Math.sin(t * 0.3) * 0.2;
    // breathe network opacity
    netMat.opacity = 0.4 + Math.sin(t * 0.6) * 0.18;
    // rotate stars slowly
    stars.rotation.y += dt * 0.005;

    controls.update();
    if (composer) composer.render(); else renderer.render(scene, camera);

    frameCount++;
    const now = performance.now();
    if (now - lastFpsUpdate > 500) {
      fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
      frameCount = 0;
      lastFpsUpdate = now;
      if (hudFrame) hudFrame.textContent = `${fps} fps`;
    }
  }
  tick();
}
