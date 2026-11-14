/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EDF GALGAMUWA — THREE.JS WEBGL SCENES & GSAP CHOREOGRAPHY (landing-3d-ngo.js)
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof gsap !== 'undefined';
  const hasScrollTrigger = hasGSAP && typeof ScrollTrigger !== 'undefined';
  const hasTHREE = typeof THREE !== 'undefined';

  if (hasGSAP && gsap.ticker) {
    // Prevent GSAP lagSmoothing from stalling preloader or entrance timelines on heavy first paint
    gsap.ticker.lagSmoothing(0);
  }

  if (hasScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    if (typeof ScrollToPlugin !== 'undefined') {
      gsap.registerPlugin(ScrollToPlugin);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CINEMATIC THREE.JS + GSAP PRELOADER & HERO ENTRANCE CHOREOGRAPHY
  // ──────────────────────────────────────────────────────────────────────────
  function runHeroEntrance() {
    if (!hasGSAP || prefersReducedMotion) {
      document.querySelectorAll('.hero-anim').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    const navShell = document.querySelector('#main-navbar .nav-shell-frame');
    if (navShell) {
      tl.fromTo(
        navShell,
        { opacity: 0, y: -14 },
        { opacity: 1, y: 0, duration: 0.55, clearProps: 'transform,opacity' },
        0
      );
      const navItems = navShell.querySelectorAll('.nav-link-item');
      if (navItems.length) {
        tl.fromTo(
          navItems,
          { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: 0.42, stagger: 0.04, clearProps: 'transform,opacity' },
          0.08
        );
      }
    }

    if (document.querySelector('.hero-anim')) {
      tl.fromTo(
        '.hero-anim',
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.72, stagger: 0.08, clearProps: 'transform' },
        0.06
      );
    }

    if (document.getElementById('hero-storyboard-stage')) {
      tl.fromTo(
        '#hero-storyboard-stage',
        { opacity: 0, y: 36, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'back.out(1.15)', clearProps: 'transform' },
        '-=0.55'
      );
      if (document.querySelector('.hero-sb-thumb')) {
        tl.fromTo(
          '.hero-sb-thumb',
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, clearProps: 'transform' },
          '-=0.4'
        );
      }
    } else if (document.getElementById('hero-giving-card')) {
      tl.fromTo(
        '#hero-giving-card',
        { opacity: 0, y: 36, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'back.out(1.2)', clearProps: 'transform' },
        '-=0.55'
      );
    }

    if (document.getElementById('hero-3d-stage')) {
      tl.fromTo(
        '#hero-3d-stage',
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.7, ease: 'power2.out' },
        0.2
      );
    }
  }

  function createPreloaderThreeController(canvas) {
    if (!canvas || !hasTHREE || prefersReducedMotion) return null;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return null;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 60);
    camera.position.set(0, 0, 8.2);

    const onResize = () => {
      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 800;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener('resize', onResize);

    // Subtle soft circular particle glow texture (zero external image request)
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(253, 224, 71, 0.82)');
    grad.addColorStop(0.7, 'rgba(16, 185, 129, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 64, 64);
    const particleTex = new THREE.CanvasTexture(pCanvas);

    // Lighting
    const ambient = new THREE.AmbientLight(0xd1fae5, 0.75);
    const goldLight = new THREE.PointLight(0xd4af37, 2.4, 24);
    goldLight.position.set(3.5, 3, 5);
    const emeraldLight = new THREE.PointLight(0x10b981, 2.0, 22);
    emeraldLight.position.set(-4, -2.5, 4);
    scene.add(ambient, goldLight, emeraldLight);

    const sanctuaryRoot = new THREE.Group();
    scene.add(sanctuaryRoot);

    // Sacred Interlocking 3D Octagram Prism Rings (Sanctuary Gold & Emerald)
    const goldEdgeMat = new THREE.LineBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.48 });
    const emeraldEdgeMat = new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.36 });

    const boxGeoA = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.85, 2.85, 2.85));
    const prismA = new THREE.LineSegments(boxGeoA, goldEdgeMat);
    const boxGeoB = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.85, 2.85, 2.85));
    const prismB = new THREE.LineSegments(boxGeoB, emeraldEdgeMat);
    prismB.rotation.set(Math.PI / 4, Math.PI / 4, 0);

    // Dual Tilted Celestial Orbital Halos
    const haloGeo1 = new THREE.TorusGeometry(2.6, 0.016, 8, 96);
    const haloMat1 = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.36 });
    const halo1 = new THREE.Mesh(haloGeo1, haloMat1);
    halo1.rotation.set(Math.PI / 2.6, 0.35, 0);

    const haloGeo2 = new THREE.TorusGeometry(3.25, 0.012, 8, 110);
    const haloMat2 = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.28 });
    const halo2 = new THREE.Mesh(haloGeo2, haloMat2);
    halo2.rotation.set(-Math.PI / 3.1, -0.45, 0.2);

    // 8 Orbiting Golden Vertex Orbs
    const orbGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd4af37,
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.2
    });
    const orbRing = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0);
      orbRing.add(orb);
    }
    orbRing.rotation.copy(halo1.rotation);

    sanctuaryRoot.add(prismA, prismB, halo1, halo2, orbRing);

    // Converging Seed-of-Noor Particle Constellation
    const count = 240;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const meta = [];
    const colGold = new THREE.Color(0xfbbf24);
    const colEm = new THREE.Color(0x34d399);
    const colWhite = new THREE.Color(0xfef9c3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 2.2 + Math.random() * 5.2;
      const z = (Math.random() - 0.5) * 6.5;
      const speed = 0.25 + Math.random() * 0.55;
      meta.push({ theta, radius, z, speed });

      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.sin(theta) * radius;
      positions[i * 3 + 2] = z;

      const c = i % 5 === 0 ? colWhite : (i % 2 === 0 ? colGold : colEm);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.22,
      map: particleTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    const state = { progress: 0, burst: 0, mouseX: 0, mouseY: 0, disposed: false };

    const onPointerMove = (e) => {
      state.mouseX = ((e.clientX / Math.max(window.innerWidth, 1)) - 0.5) * 2;
      state.mouseY = ((e.clientY / Math.max(window.innerHeight, 1)) - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let rafId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      if (state.disposed) return;
      rafId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();
      const convergeFactor = 1 - state.progress * 0.34 + state.burst * 0.85;

      prismA.rotation.y = t * 0.42;
      prismA.rotation.x = Math.sin(t * 0.5) * 0.25;
      prismB.rotation.y = -t * 0.36;
      prismB.rotation.z = t * 0.22;

      halo1.rotation.z = t * 0.35;
      halo2.rotation.z = -t * 0.26;
      orbRing.rotation.z = t * 0.35;

      const targetScale = 1 + state.progress * 0.08 + state.burst * 0.45;
      sanctuaryRoot.scale.setScalar(targetScale);
      sanctuaryRoot.rotation.y += (state.mouseX * 0.28 - sanctuaryRoot.rotation.y) * 0.06;
      sanctuaryRoot.rotation.x += (-state.mouseY * 0.22 - sanctuaryRoot.rotation.x) * 0.06;

      goldEdgeMat.opacity = Math.max(0, (0.38 + state.progress * 0.35) * (1 - state.burst));
      emeraldEdgeMat.opacity = Math.max(0, (0.32 + state.progress * 0.28) * (1 - state.burst));
      pMat.opacity = Math.max(0, 0.88 * (1 - state.burst * 0.85));

      const posAttr = pGeo.getAttribute('position');
      for (let i = 0; i < count; i++) {
        const m = meta[i];
        const ang = m.theta + t * m.speed * 0.45;
        const r = m.radius * convergeFactor;
        posAttr.array[i * 3] = Math.cos(ang) * r;
        posAttr.array[i * 3 + 1] = Math.sin(ang) * r;
        posAttr.array[i * 3 + 2] = m.z * (1 - state.progress * 0.28 + state.burst * 0.7);
      }
      posAttr.needsUpdate = true;
      particles.rotation.z = t * 0.06;

      renderer.render(scene, camera);
    };
    animate();

    return {
      setProgress(ratio) {
        state.progress = Math.max(0, Math.min(1, ratio));
      },
      triggerBurst() {
        if (hasGSAP) {
          gsap.to(state, { burst: 1, duration: 0.72, ease: 'power3.out' });
        } else {
          state.burst = 1;
        }
      },
      dispose() {
        if (state.disposed) return;
        state.disposed = true;
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointerMove);
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
        particleTex.dispose();
        renderer.dispose();
      }
    };
  }

  (function initPreloader() {
    const preloader = document.getElementById('preloader');
    const bar = document.getElementById('pl-bar-fill');
    const pctEl = document.getElementById('pl-pct');
    const stageEl = document.getElementById('pl-stage-label');
    const ringCircle = document.getElementById('pl-ring-circle');
    const canvas3d = document.getElementById('preloader-3d-canvas');
    const skipBtn = document.getElementById('pl-skip-btn');

    if (!preloader) {
      runHeroEntrance();
      return;
    }

    if (prefersReducedMotion || preloader.dataset.skipRequested === '1') {
      preloader.dataset.done = '1';
      preloader.style.display = 'none';
      runHeroEntrance();
      return;
    }

    const circumference = 377; // 2 * PI * 60
    const threeCtrl = createPreloaderThreeController(canvas3d);
    const plState = { value: 0 };
    let progressTween = null;
    let safetyHideTimer = null;

    const getStageText = (val) => {
      if (val < 32) return 'Preparing 100% Amanah Ledger…';
      if (val < 68) return 'Illuminating Education & Madrasa…';
      if (val < 96) return 'Connecting Galgamuwa Relief…';
      return 'Assalamu Alaikum · Welcome';
    };

    const syncUI = (val) => {
      const clamped = Math.max(0, Math.min(100, val));
      const rounded = Math.round(clamped);
      if (bar) bar.style.width = rounded + '%';
      if (pctEl) pctEl.textContent = rounded + '%';
      if (ringCircle) {
        ringCircle.style.strokeDashoffset = String(circumference * (1 - clamped / 100));
      }
      if (stageEl) stageEl.textContent = getStageText(rounded);
      if (threeCtrl) threeCtrl.setProgress(clamped / 100);
    };

    // GSAP Entrance Choreography for Preloader Elements
    if (hasGSAP) {
      const introTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      introTl
        .fromTo('.pl-mandala-wrap', { scale: 0.72, opacity: 0, rotate: -16 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.65, ease: 'back.out(1.45)' })
        .fromTo('.pl-calligraphy', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.4')
        .fromTo('.pl-title, .pl-subtitle', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.48, stagger: 0.07 }, '-=0.35')
        .fromTo('.pl-telemetry-card', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45 }, '-=0.3');
    }

    const hidePreloaderDom = () => {
      if (preloader.dataset.hidden === '1') return;
      preloader.dataset.hidden = '1';
      preloader.style.display = 'none';
      if (threeCtrl) threeCtrl.dispose();
    };

    const finishPreloader = () => {
      if (preloader.dataset.done === '1') return;
      preloader.dataset.done = '1';
      preloader.style.pointerEvents = 'none';
      if (progressTween) progressTween.kill();

      syncUI(100);
      if (threeCtrl) threeCtrl.triggerBurst();

      // Deterministic failsafe so preloader never stalls on background/throttled tabs
      clearTimeout(safetyHideTimer);
      safetyHideTimer = setTimeout(() => {
        hidePreloaderDom();
        runHeroEntrance();
      }, 950);

      if (hasGSAP) {
        const exitTl = gsap.timeline({
          onComplete: () => {
            clearTimeout(safetyHideTimer);
            hidePreloaderDom();
          }
        });
        exitTl
          .to('.pl-center-stage, .pl-top-bar', {
            opacity: 0,
            y: -22,
            scale: 0.96,
            duration: 0.38,
            ease: 'power2.in'
          }, 0.08)
          .to(preloader, {
            yPercent: -100,
            duration: 0.68,
            ease: 'power4.inOut'
          }, 0.16)
          .add(() => runHeroEntrance(), 0.42);
      } else {
        hidePreloaderDom();
        runHeroEntrance();
      }
    };

    window.__edfSkipPreloader = finishPreloader;
    if (skipBtn) {
      skipBtn.addEventListener('click', () => finishPreloader());
    }

    if (hasGSAP) {
      progressTween = gsap.to(plState, {
        value: 76,
        duration: 0.85,
        ease: 'power2.out',
        onUpdate: () => syncUI(plState.value)
      });

      const completeRamp = () => {
        if (preloader.dataset.done === '1') return;
        if (progressTween) progressTween.kill();
        progressTween = gsap.to(plState, {
          value: 100,
          duration: 0.45,
          ease: 'power3.inOut',
          onUpdate: () => syncUI(plState.value),
          onComplete: finishPreloader
        });
      };

      if (document.readyState === 'complete') {
        setTimeout(completeRamp, 550);
      } else {
        window.addEventListener('load', () => setTimeout(completeRamp, 220), { once: true });
      }
    } else {
      finishPreloader();
    }

    // Hard failsafe so preloader never hangs even if external assets stall
    setTimeout(() => {
      finishPreloader();
    }, 2400);
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // 2. GSAP SCROLL PROGRESS, STAGGER REVEALS, PROGRESS BARS & COUNTERS
  // ──────────────────────────────────────────────────────────────────────────
  if (hasScrollTrigger && !prefersReducedMotion) {
    // Scroll Progress Thread
    const progressBar = document.getElementById('scroll-progress-bar');
    if (progressBar) {
      gsap.to(progressBar, {
        width: '100%',
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.25
        }
      });
    }

    // Generic Scroll Reveal Sections
    gsap.utils.toArray('.gsap-reveal').forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 34 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: el,
            start: 'top 86%',
            once: true
          }
        }
      );
    });

    // Staggered Grids
    gsap.utils.toArray('.gsap-stagger-grid').forEach((grid) => {
      const cards = grid.querySelectorAll('.gsap-stagger-item');
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 32, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: grid,
            start: 'top 84%',
            once: true
          }
        }
      );
    });

    // Animated Progress Bars (Appeals & Allocation)
    gsap.utils.toArray('.progress-fill-anim').forEach((bar) => {
      const targetWidth = bar.dataset.targetWidth || bar.style.width || '0%';
      gsap.fromTo(
        bar,
        { width: '0%' },
        {
          width: targetWidth,
          duration: 1.25,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: bar,
            start: 'top 90%',
            once: true
          }
        }
      );
    });

    // Animated Numeric Counters
    gsap.utils.toArray('.gsap-counter').forEach((el) => {
      const target = parseInt(el.dataset.count || '0', 10);
      const suffix = el.dataset.suffix || '';
      if (!target) return;
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          once: true
        },
        onUpdate: () => {
          el.textContent = Math.round(obj.val).toLocaleString() + suffix;
        }
      });
    });
  }

  // Subtle 3D Mouse Tilt Micro-interaction on .tilt-card
  if (!prefersReducedMotion) {
    document.querySelectorAll('.tilt-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. THREE.JS HELPER — WEBGL GUARD & INTERSECTION OBSERVER
  // ──────────────────────────────────────────────────────────────────────────
  function observeVisibility(el, onState) {
    if (!('IntersectionObserver' in window)) {
      onState(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => onState(entry.isIntersecting));
      },
      { threshold: 0.05 }
    );
    io.observe(el);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. THREE.JS SCENE 1: HERO SACRED RUB EL HIZB & NOOR SANCTUARY
  // ──────────────────────────────────────────────────────────────────────────
  (function initHeroThreeScene() {
    const canvas = document.getElementById('hero-3d-canvas');
    if (!canvas || !hasTHREE || prefersReducedMotion) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return;
    }

    const container = canvas.parentElement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const resize = () => {
      const w = container.clientWidth || 400;
      const h = container.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const goldLight = new THREE.PointLight(0xd4af37, 2.2, 20);
    goldLight.position.set(3, 3, 4);
    scene.add(goldLight);

    const emeraldLight = new THREE.PointLight(0x10b981, 1.8, 20);
    emeraldLight.position.set(-3, -2, 3);
    scene.add(emeraldLight);

    // Master Sculpture Group
    const root = new THREE.Group();
    scene.add(root);

    // 1. Sacred Rub el Hizb (Dual Interlocking Golden Squares)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe2be4b,
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x7c580f,
      emissiveIntensity: 0.28
    });

    const createSquareFrame = (size, thickness) => {
      const grp = new THREE.Group();
      const half = size / 2;
      const barGeoH = new THREE.BoxGeometry(size + thickness, thickness, thickness);
      const barGeoV = new THREE.BoxGeometry(thickness, size + thickness, thickness);

      const top = new THREE.Mesh(barGeoH, goldMat);
      top.position.y = half;
      const bot = new THREE.Mesh(barGeoH, goldMat);
      bot.position.y = -half;
      const left = new THREE.Mesh(barGeoV, goldMat);
      left.position.x = -half;
      const right = new THREE.Mesh(barGeoV, goldMat);
      right.position.x = half;

      grp.add(top, bot, left, right);
      return grp;
    };

    const starGroup = new THREE.Group();
    const sq1 = createSquareFrame(2.7, 0.065);
    const sq2 = createSquareFrame(2.7, 0.065);
    sq2.rotation.z = Math.PI / 4;
    starGroup.add(sq1, sq2);

    // Inner Octagram Layer
    const innerSq1 = createSquareFrame(1.85, 0.04);
    const innerSq2 = createSquareFrame(1.85, 0.04);
    innerSq2.rotation.z = Math.PI / 4;
    innerSq1.position.z = 0.22;
    innerSq2.position.z = -0.22;
    starGroup.add(innerSq1, innerSq2);
    root.add(starGroup);

    // 2. Luminous Emerald Crystal Core
    const coreGeo = new THREE.IcosahedronGeometry(0.75, 0);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.55,
      metalness: 0.15,
      roughness: 0.12,
      transparent: true,
      opacity: 0.88
    });
    const crystalCore = new THREE.Mesh(coreGeo, coreMat);
    root.add(crystalCore);

    const wireCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.92, 0),
      new THREE.MeshBasicMaterial({ color: 0xf5d061, wireframe: true, transparent: true, opacity: 0.35 })
    );
    root.add(wireCore);

    // 3. Orbiting Golden Halo Rings
    const ringGeo1 = new THREE.TorusGeometry(2.35, 0.018, 16, 96);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.55 });
    const haloRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    haloRing1.rotation.x = Math.PI / 3;
    root.add(haloRing1);

    const ringGeo2 = new THREE.TorusGeometry(2.65, 0.012, 16, 96);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4 });
    const haloRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    haloRing2.rotation.y = Math.PI / 3;
    root.add(haloRing2);

    // 4. Floating Noor (Light) Particles
    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const cGold = new THREE.Color(0xf5d061);
    const cEmerald = new THREE.Color(0x34d399);

    for (let i = 0; i < particleCount; i++) {
      const r = 1.8 + Math.random() * 3.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = Math.random() > 0.35 ? cGold : cEmerald;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.055,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Interactive Drag & Hover State
    let targetRotX = 0.15;
    let targetRotY = 0;
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let currentMode = 0;

    const stageEl = container;
    stageEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, a, #hero-storyboard-stage')) return;
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    });
    window.addEventListener('pointerup', () => { isDragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        targetRotY += dx * 0.008;
        targetRotX += dy * 0.008;
        prevX = e.clientX;
        prevY = e.clientY;
      } else {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        targetRotY = nx * 0.65;
        targetRotX = ny * 0.45;
      }
    }, { passive: true });

    // Mode switcher buttons inside 3D stage
    document.querySelectorAll('.h3d-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.h3d-mode-btn').forEach((b) => {
          b.classList.remove('bg-amber-400', 'text-emerald-950');
          b.classList.add('bg-emerald-950/70', 'text-emerald-200');
        });
        e.currentTarget.classList.add('bg-amber-400', 'text-emerald-950');
        e.currentTarget.classList.remove('bg-emerald-950/70', 'text-emerald-200');
        currentMode = parseInt(e.currentTarget.dataset.mode || '0', 10);

        // Animate mode morph
        if (currentMode === 0) {
          starGroup.visible = true;
          haloRing1.scale.setScalar(1);
          crystalCore.scale.setScalar(1);
        } else if (currentMode === 1) {
          starGroup.visible = true;
          haloRing1.scale.setScalar(1.22);
          crystalCore.scale.setScalar(1.2);
        } else {
          starGroup.visible = false;
          haloRing1.scale.setScalar(0.85);
          crystalCore.scale.setScalar(1.45);
        }
      });
    });

    let isVisible = true;
    let heroScrollProgress = 0;
    observeVisibility(canvas, (v) => { isVisible = v; });

    // Scroll-coupled depth zoom & tilt on Hero Sanctuary
    if (hasScrollTrigger && document.getElementById('hero-sanctuary')) {
      ScrollTrigger.create({
        trigger: '#hero-sanctuary',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.9,
        onUpdate: (self) => {
          heroScrollProgress = self.progress || 0;
        }
      });

      const heroStage = document.getElementById('hero-storyboard-stage') || document.getElementById('hero-giving-card');
      if (heroStage) {
        gsap.to(heroStage, {
          y: -26,
          rotationX: 3,
          scale: 0.98,
          ease: 'none',
          scrollTrigger: {
            trigger: '#hero-sanctuary',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.9
          }
        });
      }
    }

    // Subtle storyboard act pulse hook for ambient sanctuary
    let actTargetSpinBoost = 0;
    window.__edfHeroAmbient = {
      setAct: (idx) => {
        actTargetSpinBoost = (idx || 0) * 0.35;
        if (hasGSAP) {
          gsap.to(goldLight, { intensity: 2.0 + (idx || 0) * 0.25, duration: 0.8, ease: 'power2.out' });
        }
      }
    };

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (!isVisible) return;

      const t = clock.getElapsedTime();

      root.rotation.y += (targetRotY + heroScrollProgress * 1.4 + actTargetSpinBoost - root.rotation.y) * 0.05;
      root.rotation.x += (targetRotX + heroScrollProgress * 0.35 - root.rotation.x) * 0.05;
      root.position.y = Math.sin(t * 1.1) * 0.12 + heroScrollProgress * 0.55;
      camera.position.z = 7.2 - heroScrollProgress * 1.35;

      starGroup.rotation.z = t * 0.14 + heroScrollProgress * 1.2 + actTargetSpinBoost * 0.5;
      crystalCore.rotation.y = t * 0.5;
      crystalCore.rotation.x = t * 0.25;
      wireCore.rotation.y = -t * 0.35;
      haloRing1.rotation.z = t * 0.3;
      haloRing2.rotation.x = -t * 0.25;
      particles.rotation.y = t * 0.06 + heroScrollProgress * 0.6;

      renderer.render(scene, camera);
    }
    animate();
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // 4A. THREE.JS + GSAP HERO ISLAMIC PEOPLES 3D STORYBOARD PAVILION
  // ──────────────────────────────────────────────────────────────────────────
  (function initHeroStoryboardThreeScene() {
    const stageCard = document.getElementById('hero-storyboard-stage');
    const viewport = document.getElementById('hero-sb-viewport');
    if (!stageCard || !viewport) return;

    const ART_PATHS = [
      '/images/hero-storyboard/act1-solidarity.jpg',
      '/images/hero-storyboard/act2-relief.jpg',
      '/images/hero-storyboard/act3-guild.jpg',
      '/images/hero-storyboard/act4-dignity.jpg'
    ];

    const DEFAULT_SB_ACTS = [
      {
        actBadge: 'ACT 01 / 04 · Verified Amanah Distribution',
        peopleRole: 'Field Assessors & Community Leaders · Galgamuwa',
        title: '01 · Transparent Assessment & Zakat Stewardship',
        caption: 'Every Zakat and Sadaqah rupee is verified through field home visits and allocated to urgent family food security and shelter needs with full audit records.',
        before: 'Silent household hardship & overdue school fees.',
        after: '100% Zakat-compliant relief delivered with dignity.',
        track: 'seasonal'
      },
      {
        actBadge: 'ACT 02 / 04 · Safe Homes & Community Care',
        peopleRole: 'Volunteer Aid Workers & Vulnerable Households',
        title: '02 · Restoring Shelters & Caring for Elders',
        caption: 'Field teams deliver essential medicines, clean water support, and dry-ration packs while repairing roofs and sanitary facilities for elderly and widowed homes.',
        before: 'Leaking roofs, unsafe wells & skipped prescriptions.',
        after: '240+ families supported with housing repairs & care.',
        track: 'medical'
      },
      {
        actBadge: 'ACT 03 / 04 · Education, Madrasa & Skills',
        peopleRole: 'Teachers, Muallimahs & Women Artisans',
        title: '03 · Unlocking Classrooms & Livelihood Skills',
        caption: 'Children receive school kits, academic scholarships, and Madrasa instruction while mothers train on tailoring equipment to build steady home income.',
        before: 'School dropouts & lack of technical or trade pathways.',
        after: '100+ sponsored students & certified village artisans.',
        track: 'education'
      },
      {
        actBadge: 'ACT 04 / 04 · Thriving Self-Reliant Families',
        peopleRole: 'Empowered Households · Rural Sri Lanka',
        title: '04 · From Emergency Aid to Lasting Self-Reliance',
        caption: 'Equipped with small-business grants, sewing looms, and youth trade training, parents fund their households independently while children excel in school.',
        before: 'Uncertain daily wages without lasting household stability.',
        after: 'Resilient families uplifting future generations.',
        track: 'women'
      }
    ];

    const canvas = document.getElementById('hero-storyboard-3d-canvas');
    const fallbackLayer = document.getElementById('hero-sb-fallback-layer');
    const fallbackImg = document.getElementById('hero-sb-fallback-img');
    const badgeEl = document.getElementById('hero-sb-act-badge');
    const roleEl = document.getElementById('hero-sb-people-role');
    const titleEl = document.getElementById('hero-sb-title');
    const captionEl = document.getElementById('hero-sb-caption');
    const beforeEl = document.getElementById('hero-lens-before');
    const afterEl = document.getElementById('hero-lens-after');
    const prevBtn = document.getElementById('sb-prev-btn');
    const nextBtn = document.getElementById('sb-next-btn');
    const autoplayBtn = document.getElementById('sb-autoplay-btn');
    const autoplayIcon = document.getElementById('sb-autoplay-icon');
    const autoplayLabel = document.getElementById('sb-autoplay-label');
    const thumbBtns = Array.from(document.querySelectorAll('.hero-sb-thumb'));
    const progressBars = thumbBtns.map((btn) => btn.querySelector('.sb-thumb-progress-bar'));

    let activeIdx = 0;
    let isAutoplay = !prefersReducedMotion;
    let isHovered = false;
    let progressTween = null;

    // Three.js coverflow state
    let webglReady = false;
    let threeVisible = true;
    const sbPanels = [];
    let sbScene = null;
    let sbCamera = null;
    let sbRenderer = null;
    let sbRoot = null;
    let arcParticles = null;
    let arcCurve = null;
    let arcSeedPhases = null;
    let dragOffsetY = 0;
    let dragOffsetX = 0;
    let hoverTiltX = 0;
    let hoverTiltY = 0;

    function getActsList() {
      const bundle = window.edfI18n && typeof window.edfI18n.getBundle === 'function'
        ? window.edfI18n.getBundle()
        : null;
      return (bundle && Array.isArray(bundle.storyboardActs) && bundle.storyboardActs.length === 4)
        ? bundle.storyboardActs
        : DEFAULT_SB_ACTS;
    }

    function computeSlotLayout(delta) {
      // Shortest circular distance for 4 panels: -1, 0, +1, or 2
      if (delta === 0) {
        return { x: 0, y: 0.1, z: 0.72, rotY: 0, scale: 1.0, glow: 0.85, frameEmit: 0.42 };
      }
      if (delta === -1) {
        return { x: -2.85, y: 0.02, z: -1.18, rotY: 0.46, scale: 0.7, glow: 0.25, frameEmit: 0.16 };
      }
      if (delta === 1) {
        return { x: 2.85, y: 0.02, z: -1.18, rotY: -0.46, scale: 0.7, glow: 0.25, frameEmit: 0.16 };
      }
      return { x: 0, y: -0.22, z: -2.5, rotY: 0.22, scale: 0.48, glow: 0.06, frameEmit: 0.08 };
    }

    function updateThreePanelTargets(immediate = false) {
      if (!webglReady || !sbPanels.length) return;
      const total = sbPanels.length;
      sbPanels.forEach((p, i) => {
        let delta = i - activeIdx;
        if (delta > total / 2) delta -= total;
        if (delta < -total / 2) delta += total;

        const cfg = computeSlotLayout(delta);
        if (immediate || !hasGSAP || prefersReducedMotion) {
          p.group.position.set(cfg.x, cfg.y, cfg.z);
          p.group.rotation.y = cfg.rotY;
          p.group.scale.setScalar(cfg.scale);
          p.glowMat.opacity = cfg.glow;
          p.goldMat.emissiveIntensity = cfg.frameEmit;
        } else {
          gsap.to(p.group.position, { x: cfg.x, y: cfg.y, z: cfg.z, duration: 0.85, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(p.group.rotation, { y: cfg.rotY, duration: 0.85, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(p.group.scale, { x: cfg.scale, y: cfg.scale, z: cfg.scale, duration: 0.85, ease: 'power3.out', overwrite: 'auto' });
          gsap.to(p.glowMat, { opacity: cfg.glow, duration: 0.65, ease: 'power2.out', overwrite: 'auto' });
          gsap.to(p.goldMat, { emissiveIntensity: cfg.frameEmit, duration: 0.65, overwrite: 'auto' });
        }
      });

      if (hasGSAP && !prefersReducedMotion && sbRoot) {
        gsap.fromTo(sbCamera.position, { z: sbCamera._baseZ + 0.16 }, { z: sbCamera._baseZ, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      }
    }

    function startProgressCycle() {
      if (progressTween) {
        progressTween.kill();
        progressTween = null;
      }
      progressBars.forEach((bar) => {
        if (!bar) return;
        if (hasGSAP) gsap.set(bar, { scaleX: 0 });
        else bar.style.transform = 'scaleX(0)';
      });

      if (!isAutoplay || prefersReducedMotion) return;
      const activeBar = progressBars[activeIdx];
      if (!activeBar) return;

      if (hasGSAP) {
        progressTween = gsap.fromTo(
          activeBar,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 5.5,
            ease: 'none',
            onComplete: () => {
              if (isAutoplay && !isHovered) {
                goToAct((activeIdx + 1) % 4, true);
              }
            }
          }
        );
        if (isHovered) progressTween.pause();
      }
    }

    function updateAutoplayButtonUI() {
      if (autoplayBtn) autoplayBtn.setAttribute('aria-pressed', isAutoplay ? 'true' : 'false');
      if (autoplayIcon) {
        autoplayIcon.className = isAutoplay ? 'fa-solid fa-pause text-[9px]' : 'fa-solid fa-play text-[9px]';
      }
      if (autoplayLabel) {
        const lang = window.edfI18n && typeof window.edfI18n.getCurrentLang === 'function' ? window.edfI18n.getCurrentLang() : 'en';
        const labels = {
          en: isAutoplay ? 'Auto' : 'Paused',
          ar: isAutoplay ? 'تلقائي' : 'متوقف',
          ta: isAutoplay ? 'தானியங்கி' : 'நிறுத்தம்',
          si: isAutoplay ? 'ස්වයං' : 'නැවතුණි'
        };
        autoplayLabel.textContent = labels[lang] || labels.en;
      }
    }

    function goToAct(idx, fromAuto = false, forceRefresh = false) {
      const next = ((idx % 4) + 4) % 4;
      const acts = getActsList();
      const act = acts[next] || DEFAULT_SB_ACTS[next];
      const changed = next !== activeIdx || forceRefresh;
      activeIdx = next;

      // Sync high-res fallback backdrop
      if (fallbackImg && ART_PATHS[next]) {
        if (fallbackImg.getAttribute('src') !== ART_PATHS[next]) {
          fallbackImg.src = ART_PATHS[next];
        }
        if (hasGSAP && !prefersReducedMotion && changed) {
          gsap.fromTo(fallbackImg, { scale: 1.07 }, { scale: 1.02, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
        }
      }

      if (badgeEl) badgeEl.textContent = act.actBadge;
      if (roleEl) {
        const span = roleEl.querySelector('span:last-child');
        if (span) span.textContent = act.peopleRole;
        else roleEl.textContent = act.peopleRole;
      }
      if (titleEl) titleEl.textContent = act.title;
      if (captionEl) captionEl.textContent = act.caption;
      if (beforeEl) beforeEl.textContent = act.before;
      if (afterEl) afterEl.textContent = act.after;

      thumbBtns.forEach((btn, i) => {
        btn.classList.toggle('is-active', i === next);
        btn.setAttribute('aria-current', i === next ? 'true' : 'false');
      });

      if (hasGSAP && !prefersReducedMotion && changed && !forceRefresh) {
        const animEls = [roleEl, titleEl, captionEl].filter(Boolean);
        gsap.fromTo(
          animEls,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out', clearProps: 'transform' }
        );
      }

      updateThreePanelTargets(forceRefresh);

      if (window.__edfHeroAmbient && typeof window.__edfHeroAmbient.setAct === 'function') {
        window.__edfHeroAmbient.setAct(next);
      }

      window.dispatchEvent(new CustomEvent('edf:storyboardact', { detail: { index: next, act, fromAuto } }));

      startProgressCycle();
    }

    // Bind Storyboard UI Controls
    thumbBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.act || '0', 10);
        goToAct(idx, false);
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => goToAct(activeIdx - 1, false));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => goToAct(activeIdx + 1, false));
    }
    if (autoplayBtn) {
      autoplayBtn.addEventListener('click', () => {
        isAutoplay = !isAutoplay;
        updateAutoplayButtonUI();
        if (isAutoplay) startProgressCycle();
        else if (progressTween) progressTween.pause();
      });
    }

    stageCard.addEventListener('mouseenter', () => {
      isHovered = true;
      if (progressTween) progressTween.pause();
    });
    stageCard.addEventListener('mouseleave', () => {
      isHovered = false;
      if (isAutoplay) {
        if (progressTween && progressTween.progress() < 1) progressTween.resume();
        else startProgressCycle();
      }
    });

    // Pointer Drag / Swipe on Viewport
    let ptrDown = false;
    let startX = 0;
    let startY = 0;
    viewport.addEventListener('pointerdown', (e) => {
      ptrDown = true;
      startX = e.clientX;
      startY = e.clientY;
    });
    window.addEventListener('pointerup', (e) => {
      if (!ptrDown) return;
      ptrDown = false;
      const dx = e.clientX - startX;
      dragOffsetY = 0;
      dragOffsetX = 0;
      if (Math.abs(dx) >= 48) {
        const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
        const step = (dx < 0 ? 1 : -1) * (isRtl ? -1 : 1);
        goToAct(activeIdx + step, false);
      }
    });
    viewport.addEventListener('pointermove', (e) => {
      const rect = viewport.getBoundingClientRect();
      hoverTiltY = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 0.18;
      hoverTiltX = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * -0.1;
      if (ptrDown) {
        dragOffsetY = Math.max(-0.35, Math.min(0.35, (e.clientX - startX) * 0.002));
        dragOffsetX = Math.max(-0.15, Math.min(0.15, (e.clientY - startY) * 0.001));
      }
    }, { passive: true });
    viewport.addEventListener('mouseleave', () => {
      hoverTiltX = 0;
      hoverTiltY = 0;
    });

    // Sync language switch seamlessly
    window.addEventListener('edf:langchange', () => {
      updateAutoplayButtonUI();
      goToAct(activeIdx, false, true);
    });

    // Initialize WebGL Three.js 3D Storyboard Pavilion
    if (canvas && hasTHREE && !prefersReducedMotion) {
      try {
        sbRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        sbRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        sbRenderer.outputEncoding = THREE.sRGBEncoding;

        sbScene = new THREE.Scene();
        sbCamera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 60);
        sbCamera._baseZ = 4.15;
        sbCamera.position.set(0, 0.08, sbCamera._baseZ);

        const resizeSB = () => {
          const w = viewport.clientWidth || 640;
          const h = viewport.clientHeight || 380;
          sbRenderer.setSize(w, h, false);
          const aspect = w / Math.max(1, h);
          sbCamera.aspect = aspect;
          // Ensure active 3D gold-framed card (~3.76 units wide) fits within horizontal FOV on mobile & desktop
          const halfFovTan = Math.tan((38 * Math.PI) / 360);
          sbCamera._baseZ = Math.max(4.05, 0.72 + 2.02 / (halfFovTan * Math.max(0.75, aspect)));
          sbCamera.position.z = sbCamera._baseZ;
          sbCamera.updateProjectionMatrix();
        };
        resizeSB();
        window.addEventListener('resize', resizeSB);

        sbScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        const sbGoldLight = new THREE.PointLight(0xf5d061, 2.0, 18);
        sbGoldLight.position.set(2.5, 2.8, 3.8);
        sbScene.add(sbGoldLight);

        const sbEmeraldLight = new THREE.PointLight(0x10b981, 1.7, 16);
        sbEmeraldLight.position.set(-2.8, -1.6, 3.2);
        sbScene.add(sbEmeraldLight);

        sbRoot = new THREE.Group();
        sbScene.add(sbRoot);

        const loader = new THREE.TextureLoader();
        let texturesLoaded = 0;

        ART_PATHS.forEach((src, i) => {
          const grp = new THREE.Group();
          const goldMat = new THREE.MeshStandardMaterial({
            color: 0xe2be4b,
            metalness: 0.78,
            roughness: 0.24,
            emissive: 0x7c580f,
            emissiveIntensity: i === 0 ? 0.42 : 0.16
          });
          const backingMat = new THREE.MeshStandardMaterial({
            color: 0x041c15,
            metalness: 0.3,
            roughness: 0.55
          });

          const backing = new THREE.Mesh(new THREE.BoxGeometry(3.62, 2.09, 0.045), backingMat);
          backing.position.z = -0.025;
          grp.add(backing);

          // Metallic Beveled Perimeter Bars
          const barH = new THREE.BoxGeometry(3.66, 0.045, 0.065);
          const barV = new THREE.BoxGeometry(0.045, 2.13, 0.065);
          const topBar = new THREE.Mesh(barH, goldMat); topBar.position.y = 1.045;
          const botBar = new THREE.Mesh(barH, goldMat); botBar.position.y = -1.045;
          const leftBar = new THREE.Mesh(barV, goldMat); leftBar.position.x = -1.81;
          const rightBar = new THREE.Mesh(barV, goldMat); rightBar.position.x = 1.81;
          grp.add(topBar, botBar, leftBar, rightBar);

          // Crown 8-point Sacred Star Finial above center of each storyboard plate
          const crownGrp = new THREE.Group();
          const cSq1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), goldMat);
          const cSq2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.04), goldMat);
          cSq2.rotation.z = Math.PI / 4;
          crownGrp.add(cSq1, cSq2);
          crownGrp.position.set(0, 1.13, 0.01);
          grp.add(crownGrp);

          // Additive golden halo rim
          const glowMat = new THREE.MeshBasicMaterial({
            color: 0xf5d061,
            transparent: true,
            opacity: i === 0 ? 0.85 : 0.25,
            wireframe: true
          });
          const glowRim = new THREE.Mesh(new THREE.PlaneGeometry(3.74, 2.18, 1, 1), glowMat);
          glowRim.position.z = -0.04;
          grp.add(glowRim);

          // Crisp Islamic Peoples Artwork Plane
          const tex = loader.load(
            src,
            () => {
              texturesLoaded++;
              if (texturesLoaded >= 1 && !webglReady) {
                webglReady = true;
                canvas.classList.add('is-ready');
                if (fallbackLayer) fallbackLayer.style.opacity = '0';
                updateThreePanelTargets(true);
              }
            },
            undefined,
            () => {}
          );
          tex.encoding = THREE.sRGBEncoding;
          tex.minFilter = THREE.LinearMipmapLinearFilter;

          const artMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
          const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.52, 1.98), artMat);
          artPlane.position.z = 0.015;
          grp.add(artPlane);

          sbRoot.add(grp);
          sbPanels.push({ group: grp, goldMat, glowMat, artMat, crownGrp });
        });

        // 3D Connecting Luminous Barakah Arc & Flowing Particles Beneath Plates
        arcCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-3.3, -1.05, -1.2),
          new THREE.Vector3(-1.4, -1.16, 0.25),
          new THREE.Vector3(0, -1.12, 0.88),
          new THREE.Vector3(1.4, -1.16, 0.25),
          new THREE.Vector3(3.3, -1.05, -1.2)
        ]);
        const ribbonMesh = new THREE.Mesh(
          new THREE.TubeGeometry(arcCurve, 64, 0.012, 8, false),
          new THREE.MeshBasicMaterial({ color: 0xf5d061, transparent: true, opacity: 0.48 })
        );
        sbRoot.add(ribbonMesh);

        const pCount = 44;
        const arcPos = new Float32Array(pCount * 3);
        arcSeedPhases = new Float32Array(pCount);
        for (let i = 0; i < pCount; i++) {
          arcSeedPhases[i] = i / pCount;
        }
        const arcGeo = new THREE.BufferGeometry();
        arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
        arcParticles = new THREE.Points(
          arcGeo,
          new THREE.PointsMaterial({ size: 0.065, color: 0xf6e08b, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
        );
        sbRoot.add(arcParticles);

        observeVisibility(viewport, (v) => { threeVisible = v; });

        const sbClock = new THREE.Clock();
        const tmpPt = new THREE.Vector3();
        function renderStoryboard3D() {
          requestAnimationFrame(renderStoryboard3D);
          if (!threeVisible || !webglReady) return;

          const t = sbClock.getElapsedTime();
          sbRoot.rotation.y += (hoverTiltY + dragOffsetY - sbRoot.rotation.y) * 0.08;
          sbRoot.rotation.x += (hoverTiltX + dragOffsetX - sbRoot.rotation.x) * 0.08;
          sbRoot.position.y = Math.sin(t * 1.15) * 0.028;

          sbPanels.forEach((p, idx) => {
            p.crownGrp.rotation.z = t * 0.45 + idx * 0.5;
          });

          if (arcCurve && arcParticles && arcSeedPhases) {
            const posAttr = arcParticles.geometry.attributes.position;
            const speedBoost = 0.075 + activeIdx * 0.02;
            for (let i = 0; i < pCount; i++) {
              const u = (arcSeedPhases[i] + t * speedBoost) % 1;
              arcCurve.getPoint(u, tmpPt);
              posAttr.setXYZ(i, tmpPt.x, tmpPt.y + Math.sin(t * 2.5 + i) * 0.03, tmpPt.z);
            }
            posAttr.needsUpdate = true;
          }

          sbRenderer.render(sbScene, sbCamera);
        }
        renderStoryboard3D();
      } catch (e) {
        // Fallback HTML layer remains sharp if WebGL context cannot initialize
      }
    }

    updateAutoplayButtonUI();
    goToAct(0, false, true);

    window.edfHeroStoryboard = {
      setAct: (idx) => goToAct(idx, false),
      next: () => goToAct(activeIdx + 1, false),
      prev: () => goToAct(activeIdx - 1, false),
      toggleAutoplay: () => {
        isAutoplay = !isAutoplay;
        updateAutoplayButtonUI();
        if (isAutoplay) startProgressCycle();
        else if (progressTween) progressTween.pause();
      }
    };
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // 4B. THREE.JS + GSAP SCROLL-DRIVEN 3D MOTION: ISLAMIC CHARITY & LIFE ELEVATION
  // ──────────────────────────────────────────────────────────────────────────
  (function initUpliftScrollThreeScene() {
    const journeyEl = document.getElementById('life-uplift-journey');
    const canvas = document.getElementById('uplift-3d-canvas');
    if (!journeyEl) return;

    const STAGES = [
      {
        badge: 'Stage 01 · Verified Need & Shelter Care',
        title: 'Immediate Relief & Assessment',
        elevation: '25%',
        elevationLabel: 'Emergency Food, Water & Field Vetting',
        before: 'Widowed, elderly, or low-income households struggling silently with empty pantries or urgent debt.',
        after: '100% Amanah Zakat & Sadaqah provides immediate rations and discreet relief within 48 hours of verification.'
      },
      {
        badge: 'Stage 02 · Healthy Homes & Infrastructure',
        title: 'Safe Housing & Rural Welfare',
        elevation: '50%',
        elevationLabel: 'Repaired Roofs, Clean Water & Medical Kits',
        before: 'Damaged roofs, lack of clean drinking water, or untreated chronic illness blocking family stability.',
        after: 'Home reconstruction grants, medical equipment loans, and clinic support restore safety and health.'
      },
      {
        badge: 'Stage 03 · Education & Vocational Academy',
        title: 'Classrooms, Madrasa & Trade Mastery',
        elevation: '75%',
        elevationLabel: 'Student Scholarships & Youth Tech Skills',
        before: 'Children at risk of leaving school and youth lacking certified technical skills for employment.',
        after: '100+ students receive school kits, Madrasa education, and mobile/CCTV technical academy training.'
      },
      {
        badge: 'Stage 04 · Community Enterprise & Dignity',
        title: 'Self-Reliant Households & Future Donors',
        elevation: '100%',
        elevationLabel: 'Micro-Grants & Sustainable Family Income',
        before: 'Cycle of aid dependency without productive tools, sewing machinery, or capital.',
        after: 'Empowered parents operate cottage enterprises, educate their children, and uplift neighbors.'
      }
    ];

    let activeStageIdx = 0;
    let targetScrollProgress = 0;
    let smoothProgress = 0;

    const chapterCards = Array.from(document.querySelectorAll('.uplift-chapter-card'));
    const stageBtns = Array.from(document.querySelectorAll('.uplift-stage-btn'));
    const hudStageEl = document.getElementById('uplift-hud-stage');
    const hudTitleEl = document.getElementById('uplift-hud-title');
    const hudBeforeEl = document.getElementById('uplift-hud-before');
    const hudAfterEl = document.getElementById('uplift-hud-after');
    const hudElevPctEl = document.getElementById('uplift-elevation-pct');
    const hudElevLblEl = document.getElementById('uplift-elevation-label');
    const hudElevBarEl = document.getElementById('uplift-elevation-bar');

    function setActiveStage(idx, forceRefresh = false) {
      const bundle = window.edfI18n && typeof window.edfI18n.getBundle === 'function'
        ? window.edfI18n.getBundle()
        : null;
      const stagesList = (bundle && Array.isArray(bundle.upliftStages) && bundle.upliftStages.length === 4)
        ? bundle.upliftStages
        : STAGES;

      const clamped = Math.max(0, Math.min(stagesList.length - 1, idx));
      if (!forceRefresh && clamped === activeStageIdx && hudStageEl && hudStageEl.dataset.init === '1') return;
      activeStageIdx = clamped;
      const st = stagesList[clamped];

      if (hudStageEl) {
        hudStageEl.dataset.init = '1';
        hudStageEl.textContent = st.badge;
      }
      if (hudTitleEl) hudTitleEl.textContent = st.title;
      if (hudBeforeEl) hudBeforeEl.textContent = st.before;
      if (hudAfterEl) hudAfterEl.textContent = st.after;
      if (hudElevPctEl) hudElevPctEl.textContent = st.elevation;
      if (hudElevLblEl) hudElevLblEl.textContent = st.elevationLabel;
      if (hudElevBarEl) hudElevBarEl.style.width = st.elevation;

      chapterCards.forEach((card, i) => {
        card.classList.toggle('is-active', i === clamped);
      });
      stageBtns.forEach((btn, i) => {
        btn.classList.toggle('is-active', i === clamped);
      });
    }

    setActiveStage(0, true);
    window.addEventListener('edf:langchange', () => setActiveStage(activeStageIdx, true));

    // Click chapter scrubber pills to scroll smoothly to corresponding card
    stageBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.stage || '0', 10);
        setActiveStage(idx);
        const card = chapterCards[idx];
        if (card) {
          if (hasGSAP && typeof ScrollToPlugin !== 'undefined') {
            gsap.to(window, { duration: 0.9, scrollTo: { y: card, offsetY: 130 }, ease: 'power3.inOut' });
          } else {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });

    // GSAP ScrollTrigger scrub & 3D perspective card reveals
    if (hasScrollTrigger && !prefersReducedMotion) {
      ScrollTrigger.create({
        trigger: journeyEl,
        start: 'top 65%',
        end: 'bottom 80%',
        scrub: 1.0,
        onUpdate: (self) => {
          targetScrollProgress = self.progress || 0;
          const stageIdx = Math.min(3, Math.floor(targetScrollProgress * 4));
          setActiveStage(stageIdx);
        }
      });

      chapterCards.forEach((card, idx) => {
        gsap.fromTo(
          card,
          { opacity: 0.45, y: 42, rotationX: 7, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            rotationX: 0,
            scale: 1,
            duration: 0.7,
            ease: 'power2.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: card,
              start: 'top 78%',
              end: 'top 35%',
              scrub: 0.7,
              onEnter: () => setActiveStage(idx),
              onEnterBack: () => setActiveStage(idx)
            }
          }
        );
      });
    }

    if (!canvas || !hasTHREE || prefersReducedMotion) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return;
    }

    const container = canvas.parentElement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, 0.25, 7.6);

    const resize = () => {
      const w = container.clientWidth || 500;
      const h = container.clientHeight || 480;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const keyGold = new THREE.PointLight(0xf5d061, 2.4, 24);
    keyGold.position.set(3.5, 4, 4.5);
    scene.add(keyGold);

    const fillEmerald = new THREE.PointLight(0x10b981, 2.0, 22);
    fillEmerald.position.set(-4, -2, 3.5);
    scene.add(fillEmerald);

    const upliftRoot = new THREE.Group();
    scene.add(upliftRoot);

    // 1. Ascending Emerald Core (Symbolizing Sincere Sadaqah Rising in Barakah)
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.6,
      metalness: 0.2,
      roughness: 0.15,
      transparent: true,
      opacity: 0.9
    });
    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), coreMat);
    const coreWire = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.88, 0),
      new THREE.MeshBasicMaterial({ color: 0xf5d061, wireframe: true, transparent: true, opacity: 0.4 })
    );
    const coreGroup = new THREE.Group();
    coreGroup.add(coreMesh, coreWire);
    upliftRoot.add(coreGroup);

    // 2. Interlocking Rub el Hizb Canopy Halo (Knowledge & Skill Shield)
    const canopyGoldMat = new THREE.MeshStandardMaterial({
      color: 0xe2be4b,
      metalness: 0.8,
      roughness: 0.22,
      emissive: 0x6b4c0d,
      emissiveIntensity: 0.25
    });
    const createFlatFrame = (size, bar) => {
      const g = new THREE.Group();
      const h = size / 2;
      const geoH = new THREE.BoxGeometry(size + bar, bar, bar);
      const geoV = new THREE.BoxGeometry(bar, size + bar, bar);
      const top = new THREE.Mesh(geoH, canopyGoldMat); top.position.y = h;
      const bot = new THREE.Mesh(geoH, canopyGoldMat); bot.position.y = -h;
      const left = new THREE.Mesh(geoV, canopyGoldMat); left.position.x = -h;
      const right = new THREE.Mesh(geoV, canopyGoldMat); right.position.x = h;
      g.add(top, bot, left, right);
      return g;
    };
    const canopyStar = new THREE.Group();
    const cs1 = createFlatFrame(2.3, 0.055);
    const cs2 = createFlatFrame(2.3, 0.055);
    cs2.rotation.z = Math.PI / 4;
    canopyStar.add(cs1, cs2);
    canopyStar.rotation.x = Math.PI / 2.2;
    upliftRoot.add(canopyStar);

    // 3. Expanding Community Relief Ripples
    const rippleRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.022, 16, 96),
      new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.55 })
    );
    rippleRing1.rotation.x = Math.PI / 2.3;
    upliftRoot.add(rippleRing1);

    const rippleRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.55, 0.014, 16, 96),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.42 })
    );
    rippleRing2.rotation.x = Math.PI / 2.3;
    upliftRoot.add(rippleRing2);

    // 4. Eight Orbiting Family Life-Status Satellites (Rise along Spiral Helix on Scroll!)
    const householdNodes = [];
    const nodeGeo = new THREE.DodecahedronGeometry(0.22, 0);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0f766e,
        emissive: 0x064e3b,
        emissiveIntensity: 0.45,
        metalness: 0.45,
        roughness: 0.25
      });
      const mesh = new THREE.Mesh(nodeGeo, mat);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.012, 8, 32),
        new THREE.MeshBasicMaterial({ color: 0xf5d061, transparent: true, opacity: 0.0 })
      );
      halo.rotation.x = Math.PI / 2;
      mesh.add(halo);
      upliftRoot.add(mesh);
      householdNodes.push({
        mesh,
        halo,
        mat,
        baseAngle: (i / 8) * Math.PI * 2
      });
    }

    // 5. Rising Barakah Golden Light Particles
    const barakahCount = 220;
    const bPos = new Float32Array(barakahCount * 3);
    const bCol = new Float32Array(barakahCount * 3);
    const colGold = new THREE.Color(0xf5d061);
    const colMint = new THREE.Color(0x34d399);
    for (let i = 0; i < barakahCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 0.8 + Math.random() * 2.9;
      bPos[i * 3] = Math.cos(angle) * rad;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
      bPos[i * 3 + 2] = Math.sin(angle) * rad;
      const c = Math.random() > 0.35 ? colGold : colMint;
      bCol[i * 3] = c.r;
      bCol[i * 3 + 1] = c.g;
      bCol[i * 3 + 2] = c.b;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    bGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    const barakahParticles = new THREE.Points(
      bGeo,
      new THREE.PointsMaterial({ size: 0.058, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
    );
    scene.add(barakahParticles);

    // Interactive Drag & Hover Tilt
    let dragRotX = 0.12;
    let dragRotY = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (dragging) {
        dragRotY += (e.clientX - lastX) * 0.008;
        dragRotX += (e.clientY - lastY) * 0.006;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    }, { passive: true });

    let isUpliftVisible = false;
    observeVisibility(canvas, (v) => { isUpliftVisible = v; });

    const clock = new THREE.Clock();
    const lowColor = new THREE.Color(0x0f766e);
    const highColor = new THREE.Color(0xf5d061);
    const lowEmissive = new THREE.Color(0x064e3b);
    const highEmissive = new THREE.Color(0x996e17);

    function renderUplift() {
      requestAnimationFrame(renderUplift);
      if (!isUpliftVisible) return;

      const t = clock.getElapsedTime();
      smoothProgress += (targetScrollProgress - smoothProgress) * 0.08;
      const p = smoothProgress;

      // Entire sculpture gently rotates with scroll + pointer drag + ambient time
      upliftRoot.rotation.y += (dragRotY + p * Math.PI * 1.4 - upliftRoot.rotation.y) * 0.06;
      upliftRoot.rotation.x += (dragRotX + 0.14 - p * 0.12 - upliftRoot.rotation.x) * 0.06;

      // Core crystal rises & blooms as Sadaqah lifts community life status
      coreGroup.position.y = -1.15 + p * 2.25 + Math.sin(t * 1.4) * 0.08;
      const coreScale = 0.78 + p * 0.55;
      coreGroup.scale.setScalar(coreScale);
      coreMesh.rotation.y = t * 0.55 + p * 2.2;
      coreWire.rotation.y = -t * 0.4;

      // Golden Rub el Hizb Canopy opens & lifts over households
      canopyStar.position.y = -0.75 + p * 2.15;
      canopyStar.rotation.z = t * 0.18 + p * 2.4;
      canopyStar.scale.setScalar(0.62 + p * 0.52);

      // Ripples expand outwards smoothly across scroll stages
      rippleRing1.position.y = -1.2 + p * 2.05;
      rippleRing1.scale.setScalar(0.75 + p * 0.6);
      rippleRing1.rotation.z = t * 0.35;

      rippleRing2.position.y = -1.0 + p * 1.8;
      rippleRing2.scale.setScalar(0.65 + p * 0.65);
      rippleRing2.rotation.z = -t * 0.25;

      // 8 Family Nodes spiral upward from hardship base (-1.4) to elevated self-reliance (+1.35)
      householdNodes.forEach((node, idx) => {
        const theta = node.baseAngle + t * 0.28 + p * Math.PI * 1.5;
        const radius = 1.45 + Math.sin(p * Math.PI) * 0.65 + p * 0.28;
        const phaseOffset = Math.sin(t * 1.5 + idx) * 0.09;
        node.mesh.position.set(
          Math.cos(theta) * radius,
          -1.35 + p * 2.65 + phaseOffset,
          Math.sin(theta) * radius
        );
        node.mesh.rotation.y = t * 0.8 + idx;
        node.mesh.scale.setScalar(0.75 + p * 0.5);
        node.mat.color.copy(lowColor).lerp(highColor, p);
        node.mat.emissive.copy(lowEmissive).lerp(highEmissive, p);
        node.halo.material.opacity = Math.max(0, (p - 0.35) * 1.15);
      });

      barakahParticles.rotation.y = t * 0.08 + p * 1.2;
      barakahParticles.position.y = -0.3 + p * 0.6;
      camera.position.z = 7.8 - Math.sin(p * Math.PI) * 0.7;

      renderer.render(scene, camera);
    }
    renderUplift();
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // 5. THREE.JS SCENE 2: ZAKAT SANCTUARY CONSTELLATION STARFIELD
  // ──────────────────────────────────────────────────────────────────────────
  (function initZakatThreeBg() {
    const canvas = document.getElementById('zakat-3d-canvas');
    if (!canvas || !hasTHREE || prefersReducedMotion) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch (e) {
      return;
    }

    const container = canvas.parentElement;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
    camera.position.z = 8;

    const resize = () => {
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const count = 180;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.065,
      color: 0xe2be4b,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(geo, mat);
    scene.add(stars);

    let isVisible = false;
    observeVisibility(canvas, (v) => { isVisible = v; });

    function tick() {
      requestAnimationFrame(tick);
      if (!isVisible) return;
      stars.rotation.y += 0.0009;
      stars.rotation.x += 0.0003;
      renderer.render(scene, camera);
    }
    tick();
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // 6. THREE.JS SCENE 3: 404 NOT FOUND CELESTIAL COMPASS / ASTROLABE
  // ──────────────────────────────────────────────────────────────────────────
  (function initNotFoundThree() {
    const canvas = document.getElementById('notfound-3d-canvas');
    if (!canvas || !hasTHREE || prefersReducedMotion) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      return;
    }

    const container = canvas.parentElement;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
    camera.position.z = 8.5;

    const resize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const group = new THREE.Group();
    scene.add(group);

    // Outer Celestial Astrolabe Rings
    const ringMatGold = new THREE.MeshBasicMaterial({ color: 0xd4af37, wireframe: false, transparent: true, opacity: 0.32 });
    const ringMatEmerald = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.25 });

    const r1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.02, 16, 100), ringMatGold);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.015, 16, 90), ringMatEmerald);
    const r3 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.018, 16, 80), ringMatGold);
    r1.rotation.x = 0.7;
    r2.rotation.y = 0.8;
    r3.rotation.x = -0.5;
    group.add(r1, r2, r3);

    // Star Particles
    const count = 240;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.06, color: 0xf5d061, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending });
    const starField = new THREE.Points(pGeo, pMat);
    scene.add(starField);

    let mx = 0, my = 0;
    window.addEventListener('mousemove', (e) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 0.6;
      my = (e.clientY / window.innerHeight - 0.5) * 0.4;
    }, { passive: true });

    const clock = new THREE.Clock();
    function loop() {
      requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      group.rotation.y += (mx - group.rotation.y) * 0.04;
      group.rotation.x += (my - group.rotation.x) * 0.04;
      r1.rotation.z = t * 0.2;
      r2.rotation.x = t * 0.25;
      r3.rotation.y = -t * 0.3;
      starField.rotation.y = t * 0.04;
      renderer.render(scene, camera);
    }
    loop();
  })();

})();

