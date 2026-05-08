/* =====================================================
   Winston Yap — site interactions
   Lenis smooth scroll + GSAP + custom cursor + reveals
   ===================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------- LOADER -------------------- */
  const loaderEl = document.getElementById('loader');
  const numEl = document.getElementById('loaderNum');
  const barEl = document.getElementById('loaderBar');

  function runLoader() {
    return new Promise((resolve) => {
      if (!loaderEl) return resolve();
      let p = 0;
      const start = performance.now();
      const dur = reduceMotion ? 200 : 1400;
      function tick(now) {
        const t = Math.min(1, (now - start) / dur);
        // smooth easeOutQuart
        const e = 1 - Math.pow(1 - t, 4);
        p = Math.round(e * 100);
        if (numEl) numEl.textContent = String(p).padStart(2, '0');
        if (barEl) barEl.style.right = `${100 - p}%`;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          loaderEl.classList.add('is-out');
          document.body.classList.remove('is-loading');
          setTimeout(() => {
            loaderEl.style.display = 'none';
            resolve();
          }, 600);
        }
      }
      requestAnimationFrame(tick);
    });
  }

  /* -------------------- LENIS SMOOTH SCROLL -------------------- */
  let lenis = null;
  function initLenis() {
    if (typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      lerp: 0.085,
    });

    // Hook Lenis into GSAP ticker so ScrollTrigger stays in sync
    if (typeof gsap !== 'undefined') {
      lenis.on('scroll', () => {
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      });
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);
    }

    // Anchor links
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id && id.length > 1) {
          const target = document.querySelector(id);
          if (target) {
            e.preventDefault();
            lenis.scrollTo(target, { offset: -10, duration: 1.6 });
          }
        }
      });
    });
  }

  /* -------------------- CUSTOM CURSOR -------------------- */
  function initCursor() {
    const cursor = document.getElementById('cursor');
    if (!cursor) return;
    if (window.matchMedia('(pointer: coarse)').matches) {
      cursor.style.display = 'none';
      document.body.classList.add('no-cursor');
      return;
    }
    const dot = cursor.querySelector('.cursor__dot');
    const ring = cursor.querySelector('.cursor__ring');
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let rx = x, ry = y;
    let dx = x, dy = y;
    window.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; });
    function loop() {
      dx += (x - dx) * 0.95;
      dy += (y - dy) * 0.95;
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      if (dot) dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`;
      if (ring) ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    }
    loop();

    // Hover state
    const hoverables = 'a, button, input, textarea, [data-cursor="hover"], .card, .event, label';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest(hoverables)) cursor.classList.add('is-hover');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest(hoverables)) cursor.classList.remove('is-hover');
    });
  }

  /* -------------------- HERO TITLE REVEAL -------------------- */
  function heroReveal() {
    if (typeof gsap === 'undefined') return;
    const lines = document.querySelectorAll('.hero__line > span');
    if (!lines.length) return;
    gsap.set(lines, { yPercent: 110 });
    gsap.to(lines, {
      yPercent: 0,
      duration: 1.2,
      ease: 'expo.out',
      stagger: 0.08,
      delay: 0.15,
    });

    // Hero meta
    gsap.from('.hero__meta .meta-tag', {
      y: 20, opacity: 0,
      duration: 0.8, ease: 'expo.out',
      stagger: 0.08,
      delay: 0.05,
    });
    // Hero bottom
    gsap.from('.hero__bottom > *', {
      y: 30, opacity: 0,
      duration: 1.0, ease: 'expo.out',
      stagger: 0.1,
      delay: 0.6,
    });
  }

  /* -------------------- HERO PARTICLES (lightweight canvas dust) -------------------- */
  function heroParticles() {
    const c = document.getElementById('heroParticles');
    if (!c || reduceMotion) return;
    const ctx = c.getContext('2d');
    let w, h, dpr, particles = [];
    function resize() {
      const rect = c.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      w = rect.width; h = rect.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn() {
      const count = Math.floor((w * h) / 14000);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random(),
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: Math.random() * 1.2 + 0.2,
          h: 200 + Math.random() * 80, // hue
        });
      }
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
        const a = 0.10 + p.z * 0.45;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h}, 80%, 80%, ${a})`;
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', () => { resize(); spawn(); });
    resize(); spawn(); frame();
  }

  /* -------------------- SCROLL REVEALS -------------------- */
  function scrollReveals() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    // Generic .reveal items
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      const dir = el.getAttribute('data-reveal') || 'up';
      const y = dir === 'down' ? -40 : 40;
      gsap.from(el, {
        y, opacity: 0,
        duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' },
      });
    });

    // Section kickers + headings split
    document.querySelectorAll('[data-line-split]').forEach((el) => {
      const text = el.textContent;
      el.textContent = '';
      const words = text.split(' ');
      const frag = document.createDocumentFragment();
      words.forEach((w, i) => {
        const wrap = document.createElement('span');
        wrap.style.display = 'inline-block';
        wrap.style.overflow = 'hidden';
        wrap.style.verticalAlign = 'baseline';
        const inner = document.createElement('span');
        inner.style.display = 'inline-block';
        inner.style.willChange = 'transform';
        inner.textContent = w;
        wrap.appendChild(inner);
        frag.appendChild(wrap);
        if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
      });
      el.appendChild(frag);

      const inners = el.querySelectorAll('span > span');
      gsap.set(inners, { yPercent: 110 });
      gsap.to(inners, {
        yPercent: 0,
        duration: 1.0, ease: 'expo.out',
        stagger: 0.04,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
      });
    });

    // Card stagger
    document.querySelectorAll('.work__grid, .speaking__grid').forEach((grid) => {
      const items = grid.children;
      gsap.from(items, {
        y: 60, opacity: 0,
        duration: 1.0, ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: grid, start: 'top 80%', toggleActions: 'play none none none' },
      });
    });

    // Card image parallax
    document.querySelectorAll('.card__media img, .event__media img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Footer name reveal
    const fname = document.querySelector('.footer__name');
    if (fname) {
      gsap.from(fname, {
        y: 80, opacity: 0,
        duration: 1.4, ease: 'expo.out',
        scrollTrigger: { trigger: fname, start: 'top 90%' },
      });
    }
  }

  /* -------------------- MARQUEE -------------------- */
  function initMarquee() {
    if (typeof gsap === 'undefined') return;
    document.querySelectorAll('[data-marquee]').forEach((wrap) => {
      const track = wrap.querySelector('.marquee__track');
      if (!track) return;
      // Duplicate content for seamless loop
      track.innerHTML = track.innerHTML + track.innerHTML;
      const w = track.scrollWidth / 2;
      gsap.to(track, {
        x: -w,
        duration: 30,
        ease: 'none',
        repeat: -1,
      });
    });
  }

  /* -------------------- MAGNETIC BUTTONS -------------------- */
  function magneticButtons() {
    if (reduceMotion) return;
    document.querySelectorAll('[data-magnetic], .btn').forEach((el) => {
      const strength = 0.3;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* -------------------- CHAT WIDGET -------------------- */
  function initChat() {
    const win = document.getElementById('gradioWindow');
    if (!win) return;
    const minBtn = document.getElementById('minBtn');
    const maxBtn = document.getElementById('maxBtn');
    const closeBtn = document.getElementById('closeBtn');
    const openBtn = document.getElementById('openWidgetBtn');

    minBtn?.addEventListener('click', () => {
      win.classList.toggle('minimized');
      win.classList.remove('maximized');
    });
    maxBtn?.addEventListener('click', () => {
      win.classList.toggle('maximized');
      win.classList.remove('minimized');
    });
    closeBtn?.addEventListener('click', () => {
      win.style.display = 'none';
      if (openBtn) openBtn.style.display = 'inline-flex';
    });
    openBtn?.addEventListener('click', () => {
      win.style.display = 'flex';
      openBtn.style.display = 'none';
    });
  }

  /* -------------------- INIT -------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('is-loading');
    initCursor();
    initLenis();
    heroParticles();
    initChat();
    magneticButtons();

    runLoader().then(() => {
      heroReveal();
      scrollReveals();
      initMarquee();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
  });

  // expose lenis (twin.js may want to disable scroll briefly)
  window.__lenis = () => lenis;
})();
