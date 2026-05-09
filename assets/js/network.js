/* ===========================================================
   About — particles.js network
   --------------------------------------------------------------
   Two particles.js v2 quirks we have to work around:

   1) It captures container.offsetWidth/Height once at init and
      never recovers if either was 0 — common when the section is
      below the fold during a loader, behind a font swap, or
      animated into view. We gate boot behind a ResizeObserver
      and re-spawn particles on later size changes.

   2) Setting `move.enable = false` cancels the internal rAF
      draw loop (`cancelRequestAnimFrame`). Setting it back to
      true does NOT restart the loop — particles, and the mouse
      repulse logic that runs inside the loop, stay frozen
      forever. We explicitly call `inst.fn.vendors.draw()` on
      resume to rekindle the loop, with a `paused` flag so we
      never start two loops in parallel.

   Plus: detect_on:'window' uses raw clientX/Y, which diverges
   from canvas-local coords once the page scrolls. We override
   the instance's mouse position each frame using
   getBoundingClientRect, which DOES account for scroll.
   =========================================================== */
(() => {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') return fn();
    document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    const target = document.getElementById('aboutNetwork');
    if (!target) return;
    if (typeof particlesJS === 'undefined') {
      console.warn('[network] particles.js missing');
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const config = {
      particles: {
        number:  { value: 90, density: { enable: true, value_area: 900 } },
        color:   { value: ['#6EE0FF', '#B49CFF', '#EDEAE2'] },
        shape:   { type: 'circle', stroke: { width: 0, color: '#000' } },
        opacity: {
          value: 0.55,
          random: true,
          anim: { enable: true, speed: 0.6, opacity_min: 0.15, sync: false }
        },
        size:    { value: 2.4, random: true, anim: { enable: false } },
        line_linked: {
          enable: true, distance: 150,
          color: '#6EE0FF', opacity: 0.25, width: 1
        },
        move: {
          enable: !reduceMotion,
          speed: 1.4,
          direction: 'none',
          random: true,
          straight: false,
          out_mode: 'out',
          bounce: false,
          attract: { enable: false }
        }
      },
      interactivity: {
        detect_on: 'window',
        events: {
          onhover: { enable: true, mode: 'repulse' },
          onclick: { enable: false },
          resize:  true
        },
        modes: { repulse: { distance: 120, duration: 0.45 } }
      },
      retina_detect: true
    };

    let inst = null;
    let visible = true;
    let paused = false;
    let lastW = 0, lastH = 0;
    let handlersAttached = false;

    /* ---------- Boot + resize via a single ResizeObserver ---------- */
    const ro = new ResizeObserver(() => {
      const w = target.offsetWidth;
      const h = target.offsetHeight;
      if (w === 0 || h === 0) return;

      if (!inst) {
        particlesJS('aboutNetwork', config);
        inst = (window.pJSDom && window.pJSDom.length)
                 ? window.pJSDom[window.pJSDom.length - 1].pJS
                 : null;
        if (!inst) return;
        lastW = w; lastH = h;
        attachHandlers();
      } else if (Math.abs(w - lastW) > 4 || Math.abs(h - lastH) > 4) {
        try {
          inst.canvas.el.width  = w;
          inst.canvas.el.height = h;
          inst.canvas.w = w;
          inst.canvas.h = h;
          if (inst.fn.particlesEmpty && inst.fn.particlesCreate) {
            inst.fn.particlesEmpty();
            inst.fn.particlesCreate();
          }
          // After a re-spawn the loop should be alive (we never set move.enable
          // to false in this branch), but kickDraw is safe to call regardless.
          kickDraw();
        } catch (err) {
          console.warn('[network] resize failed', err);
        }
        lastW = w; lastH = h;
      }
    });
    ro.observe(target);

    /* Belt-and-suspenders for late-settling layouts */
    window.addEventListener('load', kick, { once: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(kick).catch(() => {});
    }
    setTimeout(kick, 600);
    setTimeout(kick, 1500);

    function kick() {
      if (!inst && target.offsetWidth > 0 && target.offsetHeight > 0) {
        try { ro.unobserve(target); } catch (e) {}
        ro.observe(target);
      }
    }

    /* Restart the rAF draw loop if it was cancelled by move.enable=false.
       Safe to call when already running — particles.js will just append a
       frame to its existing chain (we only call this transition-style). */
    function kickDraw() {
      if (!inst || !inst.fn || !inst.fn.vendors || !inst.fn.vendors.draw) return;
      try { inst.fn.vendors.draw(); } catch (e) {}
    }

    /* ---------- Visibility pause/resume + mouse sync ---------- */
    function attachHandlers() {
      if (handlersAttached) return;
      handlersAttached = true;

      let mx = 0, my = 0, hasMouse = false;
      const onMove = (e) => { mx = e.clientX; my = e.clientY; hasMouse = true; };
      const clearMouse = () => { hasMouse = false; };
      window.addEventListener('mousemove',  onMove, { passive: true });
      window.addEventListener('mouseleave', clearMouse);
      window.addEventListener('blur',       clearMouse);
      window.addEventListener('touchmove', (e) => {
        const t = e.touches && e.touches[0];
        if (t) { mx = t.clientX; my = t.clientY; hasMouse = true; }
      }, { passive: true });
      window.addEventListener('touchend',   clearMouse);

      function syncMouse() {
        if (inst && inst.canvas && inst.canvas.el) {
          if (visible && hasMouse) {
            const r = inst.canvas.el.getBoundingClientRect();
            // particles.js stores particle coords in drawing-buffer pixels
            // (CSS pixels × pxratio when retina_detect is on). Multiply our
            // CSS-pixel cursor position by pxratio to match — otherwise the
            // repulse halo lands at half the actual cursor on retina.
            const px = inst.canvas.pxratio || 1;
            inst.interactivity.mouse.pos_x = (mx - r.left) * px;
            inst.interactivity.mouse.pos_y = (my - r.top) * px;
            inst.interactivity.status = 'mousemove';
          } else {
            inst.interactivity.mouse.pos_x = -10000;
            inst.interactivity.mouse.pos_y = -10000;
          }
        }
        requestAnimationFrame(syncMouse);
      }
      requestAnimationFrame(syncMouse);

      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
          if (!inst) continue;

          if (visible && paused) {
            // RESUME — restart the dead rAF loop
            inst.particles.move.enable = !reduceMotion;
            paused = false;
            kickDraw();
          } else if (!visible && !paused) {
            // PAUSE — particles.js will self-cancel its loop on next frame
            inst.particles.move.enable = false;
            paused = true;
          }
        }
      }, { threshold: 0.01 });
      io.observe(target);
    }
  });
})();
