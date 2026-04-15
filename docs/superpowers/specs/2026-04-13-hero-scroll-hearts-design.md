# EDF Hero Section — Scroll-Driven 3D Hearts Redesign

**Date:** 2026-04-13  
**Status:** Approved  

---

## Overview

Replace the current Three.js wireframe globe in the hero section with a scroll-driven 3D animation: small red 3D hearts fall from the top of the canvas into a gold donation chest at the bottom. The animation is tied to GSAP ScrollTrigger — as the user scrolls, hearts progressively fill the box. The cream/linen website theme is fully preserved.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hero background | Cream/linen (#F9F4EC) — unchanged | Preserve existing brand theme |
| 3D engine | Three.js (already loaded) | No new dependencies |
| Animation trigger | GSAP ScrollTrigger (pin + scrub) | Scroll-linked storytelling |
| Donation vessel | Gold-framed chest with frosted glass front | Matches EDF transparency messaging |
| Heart style | Extruded 3D hearts, red metallic material | Warm, emotional, on-brand |
| Mobile | 3D canvas hidden <768px | Preserve existing mobile behaviour |

---

## Architecture

### Files Changed

- `public/index.html` — only file modified
  - **CSS**: Replace `#hero-canvas` styles; add scroll-pin rules; add donation chest + heart styles within the existing `<style>` block
  - **HTML**: Replace `<canvas id="hero-canvas">` with a new `<div id="hero-3d-wrap">` containing a `<canvas id="hero-canvas">`
  - **JS**: Replace the existing Three.js globe IIFE with a new Three.js + GSAP ScrollTrigger scene

### No new files, no new CDN dependencies.

---

## Three.js Scene

### Hearts

- **Geometry:** `THREE.Shape` heart path (bezier curves) → `THREE.ExtrudeGeometry` with depth 0.25
- **Material:** `MeshStandardMaterial` — color `#C21833`, metalness `0.5`, roughness `0.2`
- **Count:** 12 heart instances created once, reused via object pooling
- **Sizes:** Random scale between 0.18–0.35 (small, varied)
- **Rotation:** Random slight tilt on X and Z axes per heart

### Donation Chest

- **Lid:** `BoxGeometry` — amber `MeshStandardMaterial` (#E8A020, metalness 0.7)
- **Body:** `BoxGeometry` — `MeshPhysicalMaterial` (transmission 0.6, frosted glass, warm white tint)
- **Frame:** `EdgesGeometry` on body → `LineSegments` with amber `LineBasicMaterial`
- **Slot:** Thin `BoxGeometry` on top of lid (coin slot)
- **Fill plane:** `PlaneGeometry` inside the chest body — scaleY driven by scroll progress
- **Corner rivets:** 4 small `SphereGeometry` dots at body corners

### Lighting

- `AmbientLight` — warm white `#FFF8EE`, intensity 0.9
- `DirectionalLight` — warm white, from top-right, intensity 1.2, casts soft shadows
- `PointLight` — red `#C21833` inside chest, intensity driven by fill level (dim → bright as box fills)

### Camera

- `PerspectiveCamera`, FOV 45, positioned at z=6
- Slight downward tilt: `camera.position.y = 0.5`, `camera.lookAt(0, -0.3, 0)`

---

## GSAP ScrollTrigger Animation

### Pin Setup

```js
ScrollTrigger.create({
  trigger: '#hero',
  start: 'top top',
  end: '+=200%',        // pins for 200vh of scroll
  pin: true,
  scrub: 1.5,           // silky smooth scrub
  onUpdate: (self) => updateScene(self.progress)
})
```

### Progress Stages (0–1)

| Progress | Effect |
|---|---|
| 0.00 | Box empty, no hearts. Lid has gentle idle float (separate looping tween). |
| 0.00–0.15 | Hero text + box fade/slide in (entry animation, plays once). |
| 0.15–0.40 | First wave: 3–4 hearts spawn and fall, staggered. Lid bounces open slightly. |
| 0.40–0.70 | Full rain: all 12 heart slots active, sizes varied, falling continuously. Box fill scaleY rises 0→0.6. |
| 0.70–0.90 | Box nearly full: fill scaleY 0.6→0.95. PointLight inside intensifies red glow through glass. Hearts bounce off lid rim. |
| 0.90–1.00 | Box full: dramatic burst — 20 small hearts scatter outward with `power2.out`. Counter text below box animates to "240 Families". |
| 1.00 | ScrollTrigger unpins. Page continues to ticker → impact section. |

### Heart Fall Mechanics

Each heart instance is managed by the `updateScene(progress)` function:

- Hearts are placed in a pool of 12 objects
- At each frame, `progress` maps to a `spawnRate` (0 at start, max at 0.5, tapers at 0.9)
- A heart is activated when its cooldown expires (cooldown = `lerp(2s, 0.3s, progress)`)
- Activated heart: random X (-1.8 to 1.8), starts at Y=4, falls to Y=-1.6 (top of chest)
- Fall uses GSAP tween with `ease: 'power3.in'`, duration `1.2–1.8s` (random)
- On arrival: heart scale tweens to 0 (`ease: 'back.in'`), lid briefly tilts open 8°

### Lid Interaction

- Idle (progress 0): lid bobs up/down 2px on a `gsap.to` loop (`repeat:-1, yoyo:true`)
- On heart arrival: lid rotates X by -8° for 0.2s then springs back (`elastic.out`)
- At progress 1.0: lid flings open 45° then settles

---

## HTML Structure Change

**Before:**
```html
<canvas id="hero-canvas"></canvas>
```

**After:**
```html
<div id="hero-3d-wrap">
  <canvas id="hero-canvas"></canvas>
  <div id="hero-counter" class="hero-counter">
    <span class="hcounter-num">0</span>
    <span class="hcounter-lbl">Families Helped</span>
  </div>
</div>
```

The `#hero-counter` overlays the canvas bottom-center, hidden until progress reaches 1.0, then animates in with the number counting up to 240.

---

## CSS Changes

- `#hero-canvas` — unchanged positioning (absolute, right 0, width 54%, height 100%)
- `#hero-3d-wrap` — same dimensions as canvas, wraps canvas + counter overlay
- `.hero-counter` — positioned absolute, bottom-center of wrap, initially `opacity:0`
- No changes to left-side hero text, pill, CTAs, stats, or any other section

---

## Mobile Behaviour

Below 768px:
- `#hero-3d-wrap { display: none }` — canvas and counter hidden
- Hero reverts to full-width cream layout (existing behaviour)
- No scroll pin on mobile

---

## Out of Scope

- Any section below the hero (ticker, impact, mission, programs, etc.) — untouched
- Dashboard or any other page
- Dark mode (existing `prefers-color-scheme` handling unchanged)
