/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EDF GALGAMUWA — FREE LOTTIE ANIMATED VECTOR ICONS ENGINE (lottie-web)
 * Bundles clean, zero-dependency Bodymovin JSON (v5.7.4) vector icon specs
 * styled in Sovereign Emerald & Sanctuary Gold for Navbar & Mobile Sheet UI.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  const C = {
    emerald950: [0.016, 0.110, 0.082, 1],
    emerald900: [0.024, 0.173, 0.133, 1],
    emerald700: [0.059, 0.322, 0.255, 1],
    emerald500: [0.063, 0.725, 0.506, 1],
    teal500:    [0.051, 0.580, 0.533, 1],
    amber500:   [0.961, 0.620, 0.043, 1],
    amber400:   [0.831, 0.686, 0.216, 1],
    amber300:   [0.988, 0.827, 0.302, 1],
    white:      [1, 1, 1, 1]
  };

  function sVal(v) {
    return { a: 0, k: v };
  }

  function animScalar(keyframes) {
    return {
      a: 1,
      k: keyframes.map((kf, idx) => {
        if (idx === keyframes.length - 1) return { t: kf.t, s: [kf.v] };
        return {
          t: kf.t,
          s: [kf.v],
          e: [keyframes[idx + 1].v],
          i: { x: [0.42], y: [1] },
          o: { x: [0.58], y: [0] }
        };
      })
    };
  }

  function animVec(keyframes) {
    return {
      a: 1,
      k: keyframes.map((kf, idx) => {
        if (idx === keyframes.length - 1) return { t: kf.t, s: kf.v };
        const dims = kf.v.length;
        return {
          t: kf.t,
          s: kf.v,
          e: keyframes[idx + 1].v,
          i: { x: Array(dims).fill(0.42), y: Array(dims).fill(1) },
          o: { x: Array(dims).fill(0.58), y: Array(dims).fill(0) }
        };
      })
    };
  }

  function tr(opts = {}) {
    return {
      ty: 'tr',
      p: opts.p || sVal([0, 0]),
      a: opts.a || sVal([0, 0]),
      s: opts.s || sVal([100, 100]),
      r: opts.r || sVal(0),
      o: opts.o || sVal(100)
    };
  }

  function stroke(color, width = 1.75, opacity = 100) {
    return {
      ty: 'st',
      c: sVal(color),
      o: typeof opacity === 'number' ? sVal(opacity) : opacity,
      w: sVal(width),
      lc: 2,
      lj: 2
    };
  }

  function fill(color, opacity = 100) {
    return {
      ty: 'fl',
      c: sVal(color),
      o: typeof opacity === 'number' ? sVal(opacity) : opacity,
      r: 1
    };
  }

  function polyPath(pts, closed = true) {
    const n = pts.length;
    return {
      ty: 'sh',
      d: 1,
      ks: sVal({
        c: closed,
        v: pts,
        i: Array.from({ length: n }, () => [0, 0]),
        o: Array.from({ length: n }, () => [0, 0])
      })
    };
  }

  function shapeLayer(ind, name, items, ksOpts = {}, op = 60) {
    return {
      ddd: 0,
      ind,
      ty: 4,
      nm: name,
      sr: 1,
      ks: {
        o: ksOpts.o || sVal(100),
        r: ksOpts.r || sVal(0),
        p: ksOpts.p || sVal([12, 12, 0]),
        a: ksOpts.a || sVal([0, 0, 0]),
        s: ksOpts.s || sVal([100, 100, 100])
      },
      ao: 0,
      shapes: [{ ty: 'gr', it: [...items, ksOpts.groupTr || tr()], nm: name + '-grp' }],
      ip: 0,
      op,
      st: 0
    };
  }

  function makeLottieDoc(name, layers, op = 60) {
    return {
      v: '5.7.4',
      fr: 30,
      ip: 0,
      op,
      w: 24,
      h: 24,
      nm: name,
      ddd: 0,
      assets: [],
      layers
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8 FREE BODYMOVIN LOTTIE JSON ANIMATION PRESETS
  // ──────────────────────────────────────────────────────────────────────────
  const LOTTIE_ICONS = {
    // 1. Self-Funded Verified Shield (Rotating halo + pulsing check path)
    shield: makeLottieDoc('edf-shield', [
      shapeLayer(1, 'halo', [
        { ty: 'el', d: 1, s: sVal([20, 20]), p: sVal([0, 0]) },
        stroke(C.amber400, 1.1, animScalar([{ t: 0, v: 28 }, { t: 30, v: 65 }, { t: 60, v: 28 }])),
        { ty: 'tm', s: sVal(0), e: sVal(72), o: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }]), m: 1 }
      ]),
      shapeLayer(2, 'shield-body', [
        polyPath([[0, -7.8], [6.4, -5.1], [6.4, 0.8], [0, 7.8], [-6.4, 0.8], [-6.4, -5.1]], true),
        fill(C.emerald500, 16),
        stroke(C.emerald700, 1.6)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [106, 106, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(3, 'shield-check', [
        polyPath([[-3.0, 0.2], [-0.8, 2.5], [3.3, -2.3]], false),
        {
          ty: 'tm',
          s: sVal(0),
          e: animScalar([{ t: 0, v: 65 }, { t: 22, v: 100 }, { t: 45, v: 100 }, { t: 60, v: 65 }]),
          o: sVal(0),
          m: 1
        },
        stroke(C.amber400, 1.9)
      ])
    ]),

    // 2. Islamic Mosque / Foundation Arch (Breathing dome + shimmering crescent apex)
    landmark: makeLottieDoc('edf-landmark', [
      shapeLayer(1, 'base', [
        { ty: 'rc', d: 1, s: sVal([15, 2.2]), p: sVal([0, 7.6]), r: sVal(1.1) },
        fill(C.amber400, 35),
        stroke(C.emerald700, 1.4)
      ]),
      shapeLayer(2, 'dome-arch', [
        polyPath([[-5.5, 6.2], [-5.5, 0.2], [0, -5.2], [5.5, 0.2], [5.5, 6.2]], false),
        fill(C.emerald500, 14),
        stroke(C.emerald700, 1.65)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [105, 105, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(3, 'door-arch', [
        polyPath([[-2.2, 6.2], [-2.2, 2.2], [0, 0.3], [2.2, 2.2], [2.2, 6.2]], false),
        stroke(C.amber400, 1.5)
      ]),
      shapeLayer(4, 'star-apex', [
        { ty: 'sr', sy: 1, d: 1, pt: sVal(4), p: sVal([0, -7.8]), r: sVal(0), ir: sVal(1.0), is: sVal(0), or: sVal(2.4), os: sVal(0) },
        fill(C.amber400, 95)
      ], {
        p: sVal([12, 12, 0]),
        o: animScalar([{ t: 0, v: 65 }, { t: 30, v: 100 }, { t: 60, v: 65 }]),
        r: animScalar([{ t: 0, v: 0 }, { t: 30, v: 45 }, { t: 60, v: 90 }])
      })
    ]),

    // 3. Initiatives Compass (Outer gold/emerald ring + oscillating compass needle)
    compass: makeLottieDoc('edf-compass', [
      shapeLayer(1, 'ring', [
        { ty: 'el', d: 1, s: sVal([16.5, 16.5]), p: sVal([0, 0]) },
        fill(C.emerald500, 12),
        stroke(C.emerald700, 1.6)
      ]),
      shapeLayer(2, 'needle', [
        polyPath([[0, -5.8], [2.2, 0], [0, 5.8], [-2.2, 0]], true),
        fill(C.amber400, 88),
        stroke(C.emerald900, 1.1)
      ], {
        r: animScalar([{ t: 0, v: -20 }, { t: 18, v: 28 }, { t: 40, v: -12 }, { t: 60, v: -20 }])
      }),
      shapeLayer(3, 'pivot', [
        { ty: 'el', d: 1, s: sVal([2.4, 2.4]), p: sVal([0, 0]) },
        fill(C.emerald950, 100)
      ])
    ]),

    // 4. Pillars / Sacred Knowledge Book (Open wings + rising illumination sparks)
    book: makeLottieDoc('edf-book', [
      shapeLayer(1, 'pages', [
        polyPath([[0, 6.2], [0, -3.5], [-6.8, -5.2], [-6.8, 4.5]], true),
        polyPath([[0, 6.2], [0, -3.5], [6.8, -5.2], [6.8, 4.5]], true),
        fill(C.emerald500, 14),
        stroke(C.emerald700, 1.55)
      ], {
        p: animVec([{ t: 0, v: [12, 12.6, 0] }, { t: 30, v: [12, 11.4, 0] }, { t: 60, v: [12, 12.6, 0] }])
      }),
      shapeLayer(2, 'ray-left', [
        polyPath([[-3.5, -1.5], [-3.5, -6.5]], false),
        polyPath([[3.5, -1.5], [3.5, -6.5]], false),
        {
          ty: 'tm',
          s: sVal(0),
          e: animScalar([{ t: 0, v: 40 }, { t: 30, v: 100 }, { t: 60, v: 40 }]),
          o: sVal(0),
          m: 1
        },
        stroke(C.amber400, 1.7)
      ], {
        p: sVal([12, 10.2, 0])
      })
    ]),

    // 5. Groundwork Gallery (Breathing viewfinder corners + rotating golden star flash)
    gallery: makeLottieDoc('edf-gallery', [
      shapeLayer(1, 'frame', [
        { ty: 'rc', d: 1, s: sVal([15.5, 13.5]), p: sVal([0, 0]), r: sVal(3) },
        fill(C.emerald500, 10),
        stroke(C.emerald700, 1.55)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [106, 106, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(2, 'lens-hills', [
        polyPath([[-5.4, 3.6], [-2.0, -0.4], [0.6, 2.2], [3.0, -1.4], [5.4, 3.6]], false),
        stroke(C.emerald700, 1.45)
      ]),
      shapeLayer(3, 'spark', [
        { ty: 'sr', sy: 1, d: 1, pt: sVal(4), p: sVal([0, 0]), r: sVal(0), ir: sVal(1.1), is: sVal(0), or: sVal(2.8), os: sVal(0) },
        fill(C.amber400, 95)
      ], {
        p: sVal([15.2, 8.8, 0]),
        r: animScalar([{ t: 0, v: 0 }, { t: 60, v: 90 }]),
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [122, 122, 100] }, { t: 60, v: [90, 90, 100] }])
      })
    ]),

    // 6. Community Solidarity & Join EDF (Heartbeat diamond crest + expanding aura ring)
    community: makeLottieDoc('edf-community', [
      shapeLayer(1, 'pulse-ring', [
        { ty: 'el', d: 1, s: sVal([13, 13]), p: sVal([0, 0]) },
        stroke(C.emerald700, 1.4)
      ], {
        s: animVec([{ t: 0, v: [82, 82, 100] }, { t: 42, v: [132, 132, 100] }, { t: 60, v: [82, 82, 100] }]),
        o: animScalar([{ t: 0, v: 80 }, { t: 42, v: 0 }, { t: 60, v: 0 }])
      }),
      shapeLayer(2, 'hands-arc', [
        polyPath([[-6.8, 1.5], [-4.0, 5.2], [0, 7.0], [4.0, 5.2], [6.8, 1.5]], false),
        stroke(C.emerald900, 1.75)
      ]),
      shapeLayer(3, 'gem-heart', [
        polyPath([[0, -5.8], [4.4, -1.6], [0, 2.8], [-4.4, -1.6]], true),
        fill(C.amber400, 90),
        stroke(C.emerald950, 1.2)
      ], {
        s: animVec([
          { t: 0, v: [100, 100, 100] },
          { t: 18, v: [118, 118, 100] },
          { t: 34, v: [98, 98, 100] },
          { t: 60, v: [100, 100, 100] }
        ])
      })
    ]),

    // 7. Quick Jump Search Lens (Pulsing radar ring + gentle lens tilt)
    search: makeLottieDoc('edf-search', [
      shapeLayer(1, 'radar', [
        { ty: 'el', d: 1, s: sVal([10.5, 10.5]), p: sVal([-1.2, -1.2]) },
        stroke(C.amber400, 1.2)
      ], {
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 36, v: [136, 136, 100] }, { t: 60, v: [90, 90, 100] }]),
        o: animScalar([{ t: 0, v: 75 }, { t: 36, v: 0 }, { t: 60, v: 0 }])
      }),
      shapeLayer(2, 'lens', [
        { ty: 'el', d: 1, s: sVal([10.5, 10.5]), p: sVal([-1.4, -1.4]) },
        fill(C.emerald500, 12),
        stroke(C.emerald700, 1.75)
      ], {
        r: animScalar([{ t: 0, v: 0 }, { t: 25, v: -10 }, { t: 50, v: 6 }, { t: 60, v: 0 }])
      }),
      shapeLayer(3, 'handle', [
        polyPath([[2.6, 2.6], [6.8, 6.8]], false),
        stroke(C.amber400, 2.1)
      ], {
        r: animScalar([{ t: 0, v: 0 }, { t: 25, v: -10 }, { t: 50, v: 6 }, { t: 60, v: 0 }])
      })
    ]),

    // 8. Staff Portal Security Keyhole (Animated shackle lift + golden glow core)
    portal: makeLottieDoc('edf-portal', [
      shapeLayer(1, 'shackle', [
        polyPath([[-3.8, -1.0], [-3.8, -4.6], [0, -7.2], [3.8, -4.6], [3.8, -1.0]], false),
        stroke(C.amber400, 1.75)
      ], {
        p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 10.4, 0] }, { t: 60, v: [12, 12, 0] }])
      }),
      shapeLayer(2, 'body', [
        { ty: 'rc', d: 1, s: sVal([13, 9.2]), p: sVal([0, 3.6]), r: sVal(2.4) },
        fill(C.emerald500, 18),
        stroke(C.emerald700, 1.65)
      ]),
      shapeLayer(3, 'keyhole', [
        { ty: 'el', d: 1, s: sVal([2.8, 2.8]), p: sVal([0, 3.6]) },
        fill(C.amber400, 95)
      ], {
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [125, 125, 100] }, { t: 60, v: [90, 90, 100] }])
      })
    ]),

    // 9. Explore / Stars Sparkle (For More popover & 3D story link)
    sparkles: makeLottieDoc('edf-sparkles', [
      shapeLayer(1, 'main-star', [
        { ty: 'sr', sy: 1, d: 1, pt: sVal(4), p: sVal([0, 0]), r: sVal(0), ir: sVal(2.3), is: sVal(0), or: sVal(6.6), os: sVal(0) },
        fill(C.amber400, 88),
        stroke(C.emerald700, 1.1)
      ], {
        r: animScalar([{ t: 0, v: 0 }, { t: 60, v: 90 }]),
        s: animVec([{ t: 0, v: [92, 92, 100] }, { t: 30, v: [112, 112, 100] }, { t: 60, v: [92, 92, 100] }])
      }),
      shapeLayer(2, 'sub-star', [
        { ty: 'sr', sy: 1, d: 1, pt: sVal(4), p: sVal([0, 0]), r: sVal(0), ir: sVal(1.0), is: sVal(0), or: sVal(2.8), os: sVal(0) },
        fill(C.emerald500, 95)
      ], {
        p: sVal([17.5, 6.5, 0]),
        o: animScalar([{ t: 0, v: 40 }, { t: 30, v: 100 }, { t: 60, v: 40 }]),
        r: animScalar([{ t: 0, v: 0 }, { t: 60, v: -90 }])
      })
    ]),

    // 10. Dashboard Bento Overview Grid (Staggered pulse across 4 Bento cards)
    dashboard: makeLottieDoc('edf-dashboard', [
      shapeLayer(1, 'card-tl', [
        { ty: 'rc', d: 1, s: sVal([7.2, 7.2]), p: sVal([-4.4, -4.4]), r: sVal(1.8) },
        fill(C.emerald500, 26),
        stroke(C.emerald500, 1.5)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 20, v: [108, 108, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(2, 'card-tr', [
        { ty: 'rc', d: 1, s: sVal([7.2, 7.2]), p: sVal([4.4, -4.4]), r: sVal(1.8) },
        fill(C.amber500, 32),
        stroke(C.amber400, 1.5)
      ], {
        o: animScalar([{ t: 0, v: 65 }, { t: 30, v: 100 }, { t: 60, v: 65 }])
      }),
      shapeLayer(3, 'card-bl', [
        { ty: 'rc', d: 1, s: sVal([7.2, 7.2]), p: sVal([-4.4, 4.4]), r: sVal(1.8) },
        fill(C.emerald700, 22),
        stroke(C.emerald500, 1.4)
      ]),
      shapeLayer(4, 'card-br', [
        { ty: 'rc', d: 1, s: sVal([7.2, 7.2]), p: sVal([4.4, 4.4]), r: sVal(1.8) },
        fill(C.emerald500, 20),
        stroke(C.emerald500, 1.4)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 35, v: [92, 92, 100] }, { t: 60, v: [100, 100, 100] }])
      })
    ]),

    // 11. Subscriptions / Treasury Wallet (Emerald card + gleaming Gold coin)
    wallet: makeLottieDoc('edf-wallet', [
      shapeLayer(1, 'card', [
        { ty: 'rc', d: 1, s: sVal([15.5, 11.5]), p: sVal([-0.5, 0.5]), r: sVal(2.4) },
        fill(C.emerald500, 18),
        stroke(C.emerald500, 1.65)
      ]),
      shapeLayer(2, 'clasp', [
        { ty: 'rc', d: 1, s: sVal([5.2, 3.6]), p: sVal([5.2, 0.5]), r: sVal(1.2) },
        fill(C.amber400, 88),
        stroke(C.amber500, 1.1)
      ]),
      shapeLayer(3, 'coin', [
        { ty: 'el', d: 1, s: sVal([5.6, 5.6]), p: sVal([0, -5.8]) },
        fill(C.amber300, 95),
        stroke(C.amber500, 1.2)
      ], {
        p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 9.8, 0] }, { t: 60, v: [12, 12, 0] }])
      })
    ]),

    // 12. Ramadan Crescent & Star (Breathing gold crescent + rotating star)
    crescent: makeLottieDoc('edf-crescent', [
      shapeLayer(1, 'moon-arc', [
        polyPath([[-1.5, -7.2], [-6.2, -4.5], [-7.5, 0.6], [-5.0, 5.5], [0.2, 7.2], [-2.8, 3.8], [-3.0, -1.8], [-0.4, -5.8]], true),
        fill(C.amber400, 90),
        stroke(C.amber500, 1.2)
      ], {
        r: animScalar([{ t: 0, v: -3 }, { t: 30, v: 5 }, { t: 60, v: -3 }])
      }),
      shapeLayer(2, 'star', [
        { ty: 'sr', sy: 1, d: 1, pt: sVal(4), p: sVal([4.8, -3.5]), r: sVal(0), ir: sVal(1.3), is: sVal(0), or: sVal(3.4), os: sVal(0) },
        fill(C.emerald500, 95)
      ], {
        o: animScalar([{ t: 0, v: 55 }, { t: 30, v: 100 }, { t: 60, v: 55 }]),
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [122, 122, 100] }, { t: 60, v: [90, 90, 100] }])
      })
    ]),

    // 13. Precision Settings Cog (Smooth rotating gear + amber core)
    cog: makeLottieDoc('edf-cog', [
      shapeLayer(1, 'teeth', [
        { ty: 'sr', sy: 1, d: 1, pt: sVal(8), p: sVal([0, 0]), r: sVal(0), ir: sVal(6.0), is: sVal(12), or: sVal(8.5), os: sVal(10) },
        fill(C.emerald500, 22),
        stroke(C.emerald500, 1.55)
      ], {
        r: animScalar([{ t: 0, v: 0 }, { t: 60, v: 90 }])
      }),
      shapeLayer(2, 'hub', [
        { ty: 'el', d: 1, s: sVal([5.4, 5.4]), p: sVal([0, 0]) },
        fill(C.amber400, 88),
        stroke(C.amber500, 1.1)
      ])
    ]),

    // 14. Backup & Data Vault (Shielded database pulse)
    vault: makeLottieDoc('edf-vault', [
      shapeLayer(1, 'disk-top', [
        { ty: 'rc', d: 1, s: sVal([15, 5.2]), p: sVal([0, -4.4]), r: sVal(2.0) },
        fill(C.emerald500, 22),
        stroke(C.emerald500, 1.55)
      ]),
      shapeLayer(2, 'disk-bot', [
        { ty: 'rc', d: 1, s: sVal([15, 5.2]), p: sVal([0, 3.8]), r: sVal(2.0) },
        fill(C.emerald500, 16),
        stroke(C.emerald700, 1.55)
      ]),
      shapeLayer(3, 'sync-dot', [
        { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([4.5, -4.4]) },
        fill(C.amber400, 95)
      ], {
        o: animScalar([{ t: 0, v: 40 }, { t: 28, v: 100 }, { t: 60, v: 40 }])
      })
    ]),

    // 15. Notification Bell (Gentle chime swing + gold clapper)
    bell: makeLottieDoc('edf-bell', [
      shapeLayer(1, 'dome', [
        polyPath([[0, -7.2], [4.5, -4.2], [5.8, 3.2], [-5.8, 3.2], [-4.5, -4.2]], true),
        fill(C.emerald500, 20),
        stroke(C.emerald500, 1.65)
      ], {
        r: animScalar([{ t: 0, v: 0 }, { t: 16, v: -12 }, { t: 34, v: 11 }, { t: 50, v: -6 }, { t: 60, v: 0 }])
      }),
      shapeLayer(2, 'clapper', [
        { ty: 'el', d: 1, s: sVal([3.4, 3.4]), p: sVal([0, 5.8]) },
        fill(C.amber400, 95)
      ])
    ]),

    // 16. Ramadan Aid Ticket / Token (Perforated emerald coupon + pulsing gold seal)
    ticket: makeLottieDoc('edf-ticket', [
      shapeLayer(1, 'stub-body', [
        polyPath([
          [-8, -5.2], [8, -5.2], [8, -1.6], [6.2, 0], [8, 1.6], [8, 5.2],
          [-8, 5.2], [-8, 1.6], [-6.2, 0], [-8, -1.6]
        ], true),
        fill(C.emerald500, 20),
        stroke(C.emerald500, 1.65)
      ], {
        r: animScalar([{ t: 0, v: 0 }, { t: 24, v: -4 }, { t: 48, v: 3 }, { t: 60, v: 0 }]),
        p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 24, v: [12, 11.2, 0] }, { t: 48, v: [12, 12.4, 0] }, { t: 60, v: [12, 12, 0] }])
      }),
      shapeLayer(2, 'divider-dots', [
        polyPath([[-2, -3.4], [-2, 3.4]], false),
        stroke(C.emerald700, 1.15)
      ], { o: sVal(55) }),
      shapeLayer(3, 'gold-seal', [
        { ty: 'el', d: 1, s: sVal([4.4, 4.4]), p: sVal([2.5, 0]) },
        fill(C.amber400, 92)
      ], {
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [112, 112, 100] }, { t: 60, v: [90, 90, 100] }])
      })
    ]),

    // 17. Optical QR / Barcode Laser Scanner (Reticle brackets + sweeping emerald beam)
    qrscan: makeLottieDoc('edf-qrscan', [
      shapeLayer(1, 'tl-br-frame', [
        polyPath([[-7.2, -3], [-7.2, -7.2], [-3, -7.2]], false),
        polyPath([[3, -7.2], [7.2, -7.2], [7.2, -3]], false),
        polyPath([[-7.2, 3], [-7.2, 7.2], [-3, 7.2]], false),
        polyPath([[3, 7.2], [7.2, 7.2], [7.2, 3]], false),
        stroke(C.emerald500, 1.8)
      ]),
      shapeLayer(2, 'qr-dots', [
        { ty: 'rc', d: 1, s: sVal([3.2, 3.2]), p: sVal([-3.2, -3.2]), r: sVal(0.6) },
        { ty: 'rc', d: 1, s: sVal([3.2, 3.2]), p: sVal([3.2, -3.2]), r: sVal(0.6) },
        { ty: 'rc', d: 1, s: sVal([3.2, 3.2]), p: sVal([-3.2, 3.2]), r: sVal(0.6) },
        fill(C.teal500, 35)
      ]),
      shapeLayer(3, 'laser-beam', [
        polyPath([[-6.2, 0], [6.2, 0]], false),
        stroke(C.amber400, 1.75)
      ], {
        p: animVec([{ t: 0, v: [12, 7, 0] }, { t: 30, v: [12, 17, 0] }, { t: 60, v: [12, 7, 0] }])
      })
    ]),

    // 18. Partner Shop Storefront (Awning roof + audited gold dot)
    storefront: makeLottieDoc('edf-storefront', [
      shapeLayer(1, 'store-base', [
        { ty: 'rc', d: 1, s: sVal([13, 8.2]), p: sVal([0, 2.8]), r: sVal(1.5) },
        fill(C.teal500, 16),
        stroke(C.emerald500, 1.6)
      ]),
      shapeLayer(2, 'store-awning', [
        polyPath([[-8, -1.2], [-6.2, -6.2], [6.2, -6.2], [8, -1.2]], true),
        fill(C.emerald500, 26),
        stroke(C.emerald700, 1.65)
      ], {
        p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 11.3, 0] }, { t: 60, v: [12, 12, 0] }])
      }),
      shapeLayer(3, 'audit-badge', [
        { ty: 'el', d: 1, s: sVal([4.2, 4.2]), p: sVal([6, -5.6]) },
        fill(C.amber400, 95)
      ], {
        s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 30, v: [114, 114, 100] }, { t: 60, v: [88, 88, 100] }])
      })
    ]),

    // 19. Islamic Charity & Member Giving Crest (Cradling emerald bowl + pulsing golden heart)
    charity: makeLottieDoc('edf-charity', [
      shapeLayer(1, 'halo', [
        { ty: 'el', d: 1, s: sVal([18.5, 18.5]), p: sVal([0, 0]) },
        stroke(C.amber400, 1.0, animScalar([{ t: 0, v: 22 }, { t: 30, v: 62 }, { t: 60, v: 22 }]))
      ]),
      shapeLayer(2, 'hands-cradle', [
        polyPath([[-7.2, 1.5], [-4.5, 5.5], [0, 7.2], [4.5, 5.5], [7.2, 1.5]], false),
        stroke(C.emerald500, 1.85)
      ]),
      shapeLayer(3, 'gold-heart-gem', [
        polyPath([[0, -5.8], [4.4, -2.0], [3.6, 1.4], [0, 4.2], [-3.6, 1.4], [-4.4, -2.0]], true),
        fill(C.amber400, 88),
        stroke(C.emerald700, 1.25)
      ], {
        s: animVec([{ t: 0, v: [94, 94, 100] }, { t: 24, v: [114, 114, 100] }, { t: 48, v: [98, 98, 100] }, { t: 60, v: [94, 94, 100] }]),
        p: animVec([{ t: 0, v: [12, 11.4, 0] }, { t: 24, v: [12, 10.6, 0] }, { t: 60, v: [12, 11.4, 0] }])
      })
    ]),

    // 20. Treasury Ledger Voucher (Dual flow receipt sheet + animated emerald/gold entry lines)
    ledger: makeLottieDoc('edf-ledger', [
      shapeLayer(1, 'voucher-sheet', [
        { ty: 'rc', d: 1, s: sVal([13.6, 16.2]), p: sVal([0, 0]), r: sVal(2.4) },
        fill(C.emerald500, 15),
        stroke(C.emerald500, 1.6)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [104, 104, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(2, 'entry-lines', [
        polyPath([[-3.6, -3.5], [3.6, -3.5]], false),
        polyPath([[-3.6, 0], [3.6, 0]], false),
        stroke(C.emerald700, 1.5),
        {
          ty: 'tm',
          s: sVal(0),
          e: animScalar([{ t: 0, v: 55 }, { t: 28, v: 100 }, { t: 60, v: 55 }]),
          o: sVal(0),
          m: 1
        }
      ]),
      shapeLayer(3, 'flow-badge', [
        { ty: 'el', d: 1, s: sVal([4.8, 4.8]), p: sVal([3.8, 4.4]) },
        fill(C.amber400, 95)
      ], {
        s: animVec([{ t: 0, v: [86, 86, 100] }, { t: 30, v: [115, 115, 100] }, { t: 60, v: [86, 86, 100] }])
      })
    ]),

    // 21. Treasury Balance Scale (Rotating equilibrium beam + twin emerald/gold pans)
    balance: makeLottieDoc('edf-balance', [
      shapeLayer(1, 'pillar', [
        polyPath([[0, -6.5], [0, 6.8]], false),
        polyPath([[-4.6, 6.8], [4.6, 6.8]], false),
        stroke(C.emerald700, 1.65)
      ]),
      shapeLayer(2, 'beam', [
        polyPath([[-7.2, -3.2], [7.2, -3.2]], false),
        { ty: 'el', d: 1, s: sVal([3.4, 3.4]), p: sVal([-6.6, 1.2]) },
        { ty: 'el', d: 1, s: sVal([3.4, 3.4]), p: sVal([6.6, 1.2]) },
        fill(C.amber400, 88),
        stroke(C.emerald500, 1.45)
      ], {
        r: animScalar([{ t: 0, v: -6 }, { t: 30, v: 6 }, { t: 60, v: -6 }])
      })
    ]),

    // 22. Home Reconstruction & Building Repair (Breathing gable roof + glowing sanctuary hearth beam)
    homecare: makeLottieDoc('edf-homecare', [
      shapeLayer(1, 'house-frame', [
        polyPath([[-7.2, -0.5], [0, -7.2], [7.2, -0.5], [5.8, -0.5], [5.8, 6.8], [-5.8, 6.8], [-5.8, -0.5]], true),
        fill(C.emerald500, 18),
        stroke(C.emerald700, 1.6)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [104, 104, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(2, 'roof-beam', [
        polyPath([[-8.2, 0.2], [0, -7.8], [8.2, 0.2]], false),
        stroke(C.amber400, 1.85),
        { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 65 }, { t: 28, v: 100 }, { t: 60, v: 65 }]), o: sVal(0), m: 1 }
      ]),
      shapeLayer(3, 'hearth-gem', [
        polyPath([[0, 0.4], [2.4, 3.2], [0, 6.0], [-2.4, 3.2]], true),
        fill(C.amber400, 92)
      ], {
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [118, 118, 100] }, { t: 60, v: [90, 90, 100] }])
      })
    ]),

    // 23. Equipment & Relief Kit Toolbox (Precision crate + lifting handle + pulsing gold clasp)
    toolbox: makeLottieDoc('edf-toolbox', [
      shapeLayer(1, 'handle', [
        polyPath([[-3.2, -4.2], [-3.2, -6.8], [3.2, -6.8], [3.2, -4.2]], false),
        stroke(C.amber400, 1.65)
      ], {
        p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 11.2, 0] }, { t: 60, v: [12, 12, 0] }])
      }),
      shapeLayer(2, 'case-body', [
        { ty: 'rc', d: 1, s: sVal([15.6, 10.6]), p: sVal([0, 1.2]), r: sVal(2.4) },
        fill(C.emerald500, 18),
        stroke(C.emerald700, 1.6)
      ]),
      shapeLayer(3, 'clasp-line', [
        polyPath([[-7.2, 0.2], [7.2, 0.2]], false),
        stroke(C.emerald500, 1.3)
      ]),
      shapeLayer(4, 'clasp-gem', [
        { ty: 'rc', d: 1, s: sVal([3.4, 3.4]), p: sVal([0, 0.2]), r: sVal(0.9) },
        fill(C.amber400, 96)
      ], {
        s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 30, v: [120, 120, 100] }, { t: 60, v: [88, 88, 100] }])
      })
    ]),

    // 24. Documents & Archives Vault (Emerald folio + folded gold corner + animated lines)
    docvault: makeLottieDoc('edf-docvault', [
      shapeLayer(1, 'folio-back', [
        { ty: 'rc', d: 1, s: sVal([12.4, 15.2]), p: sVal([0.8, 0.8]), r: sVal(2.0) },
        fill(C.emerald500, 12),
        stroke(C.teal500, 1.15)
      ]),
      shapeLayer(2, 'folio-front', [
        { ty: 'rc', d: 1, s: sVal([12.6, 15.4]), p: sVal([-0.8, -0.4]), r: sVal(2.0) },
        fill(C.emerald500, 18),
        stroke(C.emerald700, 1.55)
      ]),
      shapeLayer(3, 'doc-lines', [
        polyPath([[-4.4, -2.5], [2.4, -2.5]], false),
        polyPath([[-4.4, 0.8], [2.4, 0.8]], false),
        polyPath([[-4.4, 4.1], [-0.4, 4.1]], false),
        stroke(C.emerald700, 1.45),
        { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 55 }, { t: 28, v: 100 }, { t: 60, v: 55 }]), o: sVal(0), m: 1 }
      ]),
      shapeLayer(4, 'gold-seal', [
        polyPath([[3.0, -7.2], [5.8, -4.4], [3.0, -4.4]], true),
        fill(C.amber400, 96)
      ], {
        s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [115, 115, 100] }, { t: 60, v: [90, 90, 100] }])
      })
    ]),

    // 25. Cloud Vault Upload Tray (Ascending Sanctuary Gold arrow + emerald receiving tray + halo)
    cloudupload: makeLottieDoc('edf-cloudupload', [
      shapeLayer(1, 'upload-halo', [
        { ty: 'el', d: 1, s: sVal([18.5, 18.5]), p: sVal([0, -0.5]) },
        stroke(C.emerald500, 1.0, animScalar([{ t: 0, v: 20 }, { t: 30, v: 62 }, { t: 60, v: 20 }])),
        { ty: 'tm', s: sVal(0), e: sVal(70), o: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }]), m: 1 }
      ]),
      shapeLayer(2, 'upload-tray', [
        polyPath([[-7.2, 2.2], [-7.2, 6.2], [7.2, 6.2], [7.2, 2.2]], false),
        stroke(C.emerald700, 1.75)
      ]),
      shapeLayer(3, 'upload-arrow', [
        polyPath([[0, 2.8], [0, -5.8]], false),
        polyPath([[-3.8, -2.2], [0, -6.2], [3.8, -2.2]], false),
        stroke(C.amber400, 1.9)
      ], {
        p: animVec([{ t: 0, v: [12, 13.0, 0] }, { t: 30, v: [12, 10.6, 0] }, { t: 60, v: [12, 13.0, 0] }])
      })
    ]),

    // 26. Isometric Asset Cube (Emerald hex asset box + gold scan ribbon & top flap)
    assetbox: makeLottieDoc('edf-assetbox', [
      shapeLayer(1, 'hex-cube', [
        polyPath([[0, -7.8], [7.2, -3.9], [7.2, 3.9], [0, 7.8], [-7.2, 3.9], [-7.2, -3.9]], true),
        fill(C.emerald500, 16),
        stroke(C.emerald700, 1.55)
      ], {
        s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [105, 105, 100] }, { t: 60, v: [100, 100, 100] }])
      }),
      shapeLayer(2, 'cube-ribs', [
        polyPath([[-7.0, -3.8], [0, 0], [7.0, -3.8]], false),
        polyPath([[0, 0], [0, 7.5]], false),
        stroke(C.emerald500, 1.35)
      ]),
      shapeLayer(3, 'gold-band', [
        polyPath([[-3.6, -5.7], [3.6, -1.9]], false),
        stroke(C.amber400, 1.85),
        { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 40 }, { t: 28, v: 100 }, { t: 60, v: 40 }]), o: sVal(0), m: 1 }
      ])
    ]),

    // 27. Check-Out / Maintenance Clipboard (Emerald board + gold clasp & animated tick lines)
    clipcheck: makeLottieDoc('edf-clipcheck', [
      shapeLayer(1, 'board', [
        { ty: 'rc', d: 1, s: sVal([13.6, 15.8]), p: sVal([0, 0.8]), r: sVal(2.2) },
        fill(C.emerald500, 16),
        stroke(C.emerald700, 1.55)
      ]),
      shapeLayer(2, 'clip', [
        { ty: 'rc', d: 1, s: sVal([5.6, 2.4]), p: sVal([0, -7.1]), r: sVal(0.9) },
        fill(C.amber400, 95)
      ]),
      shapeLayer(3, 'check-lines', [
        polyPath([[-3.8, -1.8], [-1.6, 0.4], [3.8, -3.2]], false),
        polyPath([[-3.8, 3.8], [3.8, 3.8]], false),
        stroke(C.amber400, 1.75),
        { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 60 }, { t: 26, v: 100 }, { t: 60, v: 60 }]), o: sVal(0), m: 1 }
      ])
    ])
  };



  LOTTIE_ICONS.smswave = makeLottieDoc('edf-smswave', [
    shapeLayer(1, 'bubble', [
      polyPath([[-7.2, -5], [7.2, -5], [7.2, 3.6], [-1.8, 3.6], [-5.2, 6.8], [-5.2, 3.6], [-7.2, 3.6]], true),
      fill(C.emerald500, 16),
      stroke(C.emerald700, 1.65)
    ]),
    shapeLayer(2, 'signal', [
      polyPath([[-3.2, -1.8], [3.2, -1.8]], false),
      polyPath([[-3.2, 0.8], [1.4, 0.8]], false),
      stroke(C.amber400, 1.85)
    ], {
      p: animVec([{ t: 0, v: [12, 12.2, 0] }, { t: 30, v: [12, 11.4, 0] }, { t: 60, v: [12, 12.2, 0] }])
    })
  ]);

  // 29. Member Registry Fellowship (Dual member silhouettes + pulsing emerald/gold crest)
  LOTTIE_ICONS.members = makeLottieDoc('edf-members', [
    shapeLayer(1, 'peer-member', [
      { ty: 'el', d: 1, s: sVal([4.0, 4.0]), p: sVal([4.0, -3.0]) },
      polyPath([[1.2, 5.8], [2.4, 2.0], [5.8, 2.0], [7.2, 5.8]], false),
      stroke(C.teal500, 1.45)
    ], {
      s: animVec([{ t: 0, v: [96, 96, 100] }, { t: 30, v: [104, 104, 100] }, { t: 60, v: [96, 96, 100] }])
    }),
    shapeLayer(2, 'lead-member', [
      { ty: 'el', d: 1, s: sVal([5.2, 5.2]), p: sVal([-2.2, -3.4]) },
      polyPath([[-7.0, 6.4], [-5.6, 1.8], [1.2, 1.8], [2.6, 6.4]], true),
      fill(C.emerald500, 20),
      stroke(C.emerald500, 1.65)
    ]),
    shapeLayer(3, 'fellowship-spark', [
      { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([4.8, -5.8]) },
      fill(C.amber400, 95)
    ], {
      s: animVec([{ t: 0, v: [85, 85, 100] }, { t: 30, v: [120, 120, 100] }, { t: 60, v: [85, 85, 100] }])
    })
  ]);

  // 30. Beneficiaries Welfare Hands (Dual cradling hands + floating sanctuary aid jewel)
  LOTTIE_ICONS.beneficiaries = makeLottieDoc('edf-beneficiaries', [
    shapeLayer(1, 'welfare-aura', [
      { ty: 'el', d: 1, s: sVal([18.4, 18.4]), p: sVal([0, 0]) },
      stroke(C.amber400, 1.0, animScalar([{ t: 0, v: 22 }, { t: 30, v: 64 }, { t: 60, v: 22 }]))
    ]),
    shapeLayer(2, 'cradling-palms', [
      polyPath([[-7.4, 0.2], [-5.4, 5.4], [-0.8, 6.8]], false),
      polyPath([[7.4, 0.2], [5.4, 5.4], [0.8, 6.8]], false),
      stroke(C.emerald500, 1.8)
    ], {
      p: animVec([{ t: 0, v: [12, 12.2, 0] }, { t: 30, v: [12, 11.4, 0] }, { t: 60, v: [12, 12.2, 0] }])
    }),
    shapeLayer(3, 'aid-emblem', [
      polyPath([[0, -5.8], [4.0, -2.4], [3.2, 1.2], [0, 4.0], [-3.2, 1.2], [-4.0, -2.4]], true),
      fill(C.amber400, 88),
      stroke(C.emerald500, 1.2)
    ], {
      s: animVec([{ t: 0, v: [92, 92, 100] }, { t: 28, v: [115, 115, 100] }, { t: 60, v: [92, 92, 100] }])
    })
  ]);

  // 31. Volunteer Force (Orbital action halo + member badge + rising star beacon)
  LOTTIE_ICONS.volunteers = makeLottieDoc('edf-volunteers', [
    shapeLayer(1, 'service-orbit', [
      { ty: 'el', d: 1, s: sVal([18.4, 18.4]), p: sVal([0, 0]) },
      stroke(C.emerald500, 1.05, animScalar([{ t: 0, v: 24 }, { t: 30, v: 62 }, { t: 60, v: 24 }])),
      { ty: 'tm', s: sVal(0), e: sVal(68), o: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }]), m: 1 }
    ]),
    shapeLayer(2, 'volunteer-silhouette', [
      { ty: 'el', d: 1, s: sVal([4.8, 4.8]), p: sVal([-0.8, -3.2]) },
      polyPath([[-6.2, 6.2], [-4.4, 1.6], [2.8, 1.6], [4.6, 6.2]], true),
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.6)
    ]),
    shapeLayer(3, 'volunteer-star', [
      polyPath([[5.4, -6.4], [6.4, -4.0], [8.2, -3.2], [6.4, -2.4], [5.4, 0], [4.4, -2.4], [2.6, -3.2], [4.4, -4.0]], true),
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [86, 86, 100] }, { t: 30, v: [118, 118, 100] }, { t: 60, v: [86, 86, 100] }])
    })
  ]);

  // 32. Academy & Programs Mortarboard (Floating scholar cap + swinging sanctuary gold tassel)
  LOTTIE_ICONS.gradcap = makeLottieDoc('edf-gradcap', [
    shapeLayer(1, 'scholar-crown', [
      polyPath([[-5.0, 0.2], [-5.0, 4.4], [0, 6.6], [5.0, 4.4], [5.0, 0.2]], false),
      fill(C.teal500, 14),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'mortarboard', [
      polyPath([[0, -6.8], [8.2, -2.4], [0, 1.8], [-8.2, -2.4]], true),
      fill(C.emerald500, 22),
      stroke(C.emerald500, 1.65)
    ], {
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 11.2, 0] }, { t: 60, v: [12, 12, 0] }])
    }),
    shapeLayer(3, 'gold-tassel', [
      polyPath([[6.6, -1.6], [6.6, 3.8]], false),
      { ty: 'el', d: 1, s: sVal([2.8, 2.8]), p: sVal([6.6, 4.8]) },
      fill(C.amber400, 96),
      stroke(C.amber400, 1.55)
    ], {
      r: animScalar([{ t: 0, v: -6 }, { t: 30, v: 6 }, { t: 60, v: -6 }])
    })
  ]);

  // 33. Access & Admins (Breathing emerald authority shield + steward silhouette + gold crown node)
  LOTTIE_ICONS.usersadmin = makeLottieDoc('edf-usersadmin', [
    shapeLayer(1, 'admin-shield', [
      polyPath([[0, -7.8], [6.8, -4.6], [6.4, 2.2], [0, 7.8], [-6.4, 2.2], [-6.8, -4.6]], true),
      fill(C.emerald500, 15),
      stroke(C.emerald500, 1.55)
    ], {
      s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [104, 104, 100] }, { t: 60, v: [100, 100, 100] }])
    }),
    shapeLayer(2, 'admin-bust', [
      { ty: 'el', d: 1, s: sVal([4.0, 4.0]), p: sVal([0, -1.6]) },
      polyPath([[-3.8, 4.2], [-2.2, 1.6], [2.2, 1.6], [3.8, 4.2]], false),
      stroke(C.teal500, 1.55)
    ]),
    shapeLayer(3, 'admin-seal', [
      { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([0, -5.2]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [86, 86, 100] }, { t: 30, v: [118, 118, 100] }, { t: 60, v: [86, 86, 100] }])
    })
  ]);

  // 34. System Telemetry Pulse (Framed monitor + animated ECG trim-path trace + live beacon)
  LOTTIE_ICONS.pulsewave = makeLottieDoc('edf-pulsewave', [
    shapeLayer(1, 'monitor-frame', [
      { ty: 'rc', d: 1, s: sVal([16.4, 14.4]), p: sVal([0, 0]), r: sVal(3.2) },
      fill(C.emerald500, 14),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'ecg-trace', [
      polyPath([[-6.2, 0.8], [-3.4, 0.8], [-1.6, -4.2], [1.0, 4.4], [2.8, -1.2], [6.2, -1.2]], false),
      stroke(C.amber400, 1.75),
      { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 42 }, { t: 28, v: 100 }, { t: 60, v: 42 }]), o: sVal(0), m: 1 }
    ]),
    shapeLayer(3, 'live-beacon', [
      { ty: 'el', d: 1, s: sVal([2.8, 2.8]), p: sVal([5.2, -4.4]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [82, 82, 100] }, { t: 30, v: [124, 124, 100] }, { t: 60, v: [82, 82, 100] }])
    })
  ]);

  // 35. Profile Medallion (Rotating emerald ring + centered avatar + golden verified pip)
  LOTTIE_ICONS.profilecard = makeLottieDoc('edf-profilecard', [
    shapeLayer(1, 'profile-halo', [
      { ty: 'el', d: 1, s: sVal([16.8, 16.8]), p: sVal([0, 0]) },
      stroke(C.emerald500, 1.5),
      { ty: 'tm', s: sVal(0), e: sVal(84), o: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }]), m: 1 }
    ]),
    shapeLayer(2, 'avatar-figure', [
      { ty: 'el', d: 1, s: sVal([4.8, 4.8]), p: sVal([0, -2.0]) },
      polyPath([[-4.4, 5.2], [-2.8, 2.0], [2.8, 2.0], [4.4, 5.2]], false),
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(3, 'verified-dot', [
      { ty: 'el', d: 1, s: sVal([3.4, 3.4]), p: sVal([5.8, -5.6]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 30, v: [118, 118, 100] }, { t: 60, v: [88, 88, 100] }])
    })
  ]);

  // 36. Submenu Records List (Staggered ledger rows + pulsing Sanctuary Gold bullet nodes)
  LOTTIE_ICONS.listitems = makeLottieDoc('edf-listitems', [
    shapeLayer(1, 'list-lines', [
      polyPath([[-1.8, -4.4], [6.4, -4.4]], false),
      polyPath([[-1.8, 0], [6.4, 0]], false),
      polyPath([[-1.8, 4.4], [6.4, 4.4]], false),
      stroke(C.emerald500, 1.8),
      { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 62 }, { t: 28, v: 100 }, { t: 60, v: 62 }]), o: sVal(0), m: 1 }
    ]),
    shapeLayer(2, 'list-dots', [
      { ty: 'el', d: 1, s: sVal([2.5, 2.5]), p: sVal([-5.4, -4.4]) },
      { ty: 'el', d: 1, s: sVal([2.5, 2.5]), p: sVal([-5.4, 0]) },
      { ty: 'el', d: 1, s: sVal([2.5, 2.5]), p: sVal([-5.4, 4.4]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [115, 115, 100] }, { t: 60, v: [90, 90, 100] }])
    })
  ]);

  // 37. Submenu Quick Register User+ (Member bust + pulsing golden plus badge)
  LOTTIE_ICONS.useradd = makeLottieDoc('edf-useradd', [
    shapeLayer(1, 'new-member-bust', [
      { ty: 'el', d: 1, s: sVal([4.8, 4.8]), p: sVal([-2.2, -2.8]) },
      polyPath([[-6.8, 5.8], [-5.0, 1.4], [0.6, 1.4], [2.4, 5.8]], true),
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.6)
    ]),
    shapeLayer(2, 'plus-cross', [
      polyPath([[5.0, -3.4], [5.0, 2.0]], false),
      polyPath([[2.3, -0.7], [7.7, -0.7]], false),
      stroke(C.amber400, 1.9)
    ], {
      s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 30, v: [118, 118, 100] }, { t: 60, v: [88, 88, 100] }])
    })
  ]);

  // 38. Submenu Category Tag (Gently swinging emerald tag + Sanctuary Gold grommet)
  LOTTIE_ICONS.tagbadge = makeLottieDoc('edf-tagbadge', [
    shapeLayer(1, 'tag-plate', [
      polyPath([[-6.6, -6.6], [-0.8, -6.6], [6.6, 0.8], [0.8, 6.6], [-6.6, -0.8]], true),
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.6)
    ], {
      r: animScalar([{ t: 0, v: -6 }, { t: 30, v: 6 }, { t: 60, v: -6 }])
    }),
    shapeLayer(2, 'tag-grommet', [
      { ty: 'el', d: 1, s: sVal([2.8, 2.8]), p: sVal([-3.0, -3.0]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 30, v: [116, 116, 100] }, { t: 60, v: [88, 88, 100] }])
    })
  ]);

  // 39. Submenu App Layout Customizer (Framed UI shell + breathing Sanctuary Gold hero pane)
  LOTTIE_ICONS.layoutui = makeLottieDoc('edf-layoutui', [
    shapeLayer(1, 'ui-frame', [
      { ty: 'rc', d: 1, s: sVal([15.6, 14.4]), p: sVal([0, 0]), r: sVal(2.6) },
      fill(C.emerald500, 14),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'ui-topbar', [
      polyPath([[-5.2, -3.4], [5.2, -3.4]], false),
      polyPath([[-1.8, -0.4], [-1.8, 4.8]], false),
      stroke(C.teal500, 1.45)
    ]),
    shapeLayer(3, 'ui-accent-card', [
      { ty: 'rc', d: 1, s: sVal([5.2, 4.6]), p: sVal([2.4, 2.2]), r: sVal(1.2) },
      fill(C.amber400, 90)
    ], {
      s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 30, v: [112, 112, 100] }, { t: 60, v: [90, 90, 100] }])
    })
  ]);

  // 40. Footer Mini Preferences Sliders (Emerald mixer rails + gliding gold fader beads)
  LOTTIE_ICONS.sliders = makeLottieDoc('edf-sliders', [
    shapeLayer(1, 'slider-rails', [
      polyPath([[-6.8, -4.2], [6.8, -4.2]], false),
      polyPath([[-6.8, 0], [6.8, 0]], false),
      polyPath([[-6.8, 4.2], [6.8, 4.2]], false),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'knob-top-bot', [
      { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([-2.2, -4.2]) },
      { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([-1.2, 4.2]) },
      fill(C.amber400, 96)
    ], {
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 30, v: [14.2, 12, 0] }, { t: 60, v: [12, 12, 0] }])
    }),
    shapeLayer(3, 'knob-mid', [
      { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([2.4, 0]) },
      fill(C.amber300, 96)
    ], {
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 30, v: [9.8, 12, 0] }, { t: 60, v: [12, 12, 0] }])
    })
  ]);

  // 41. Footer Sign Out Portal (Open frame + gliding exit arrow)
  LOTTIE_ICONS.logout = makeLottieDoc('edf-logout', [
    shapeLayer(1, 'portal-frame', [
      polyPath([[0.8, -6.4], [-5.8, -6.4], [-5.8, 6.4], [0.8, 6.4]], false),
      stroke(C.emerald500, 1.65)
    ]),
    shapeLayer(2, 'exit-arrow', [
      polyPath([[-1.4, 0], [6.2, 0]], false),
      polyPath([[3.4, -3.0], [6.6, 0], [3.4, 3.0]], false),
      stroke(C.amber400, 1.85)
    ], {
      p: animVec([{ t: 0, v: [11.6, 12, 0] }, { t: 28, v: [13.4, 12, 0] }, { t: 60, v: [11.6, 12, 0] }])
    })
  ]);

  // 42. Credential & Password Vault Keylock (Lifting emerald padlock shackle + pulsing gold keyhole)
  LOTTIE_ICONS.keylock = makeLottieDoc('edf-keylock', [
    shapeLayer(1, 'lock-shackle', [
      polyPath([[-4.0, -1.2], [-4.0, -4.8], [-2.2, -6.8], [2.2, -6.8], [4.0, -4.8], [4.0, -1.2]], false),
      stroke(C.emerald500, 1.75)
    ], {
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 11.0, 0] }, { t: 60, v: [12, 12, 0] }])
    }),
    shapeLayer(2, 'lock-body', [
      { ty: 'rc', d: 1, s: sVal([13.6, 9.6]), p: sVal([0, 3.0]), r: sVal(2.6) },
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.6)
    ]),
    shapeLayer(3, 'keyhole-gem', [
      { ty: 'el', d: 1, s: sVal([3.4, 3.4]), p: sVal([0, 2.2]) },
      polyPath([[0, 3.4], [0, 5.4]], false),
      fill(C.amber400, 96),
      stroke(C.amber400, 1.6)
    ], {
      s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 30, v: [118, 118, 100] }, { t: 60, v: [88, 88, 100] }])
    })
  ]);

  // 43. Live Telemetry Radar Wave (Expanding sonar ring + rotating emerald sweep + gold core)
  LOTTIE_ICONS.radarwave = makeLottieDoc('edf-radarwave', [
    shapeLayer(1, 'radar-outer', [
      { ty: 'el', d: 1, s: sVal([18.4, 18.4]), p: sVal([0, 0]) },
      stroke(C.emerald500, 1.25, animScalar([{ t: 0, v: 26 }, { t: 30, v: 78 }, { t: 60, v: 26 }])),
      { ty: 'tm', s: sVal(0), e: sVal(72), o: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }]), m: 1 }
    ]),
    shapeLayer(2, 'radar-inner', [
      { ty: 'el', d: 1, s: sVal([11.2, 11.2]), p: sVal([0, 0]) },
      stroke(C.teal500, 1.35)
    ], {
      s: animVec([{ t: 0, v: [92, 92, 100] }, { t: 30, v: [108, 108, 100] }, { t: 60, v: [92, 92, 100] }])
    }),
    shapeLayer(3, 'radar-core', [
      { ty: 'el', d: 1, s: sVal([4.4, 4.4]), p: sVal([0, 0]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [86, 86, 100] }, { t: 30, v: [122, 122, 100] }, { t: 60, v: [86, 86, 100] }])
    })
  ]);

  // 44. User Security Inspection Lens (Dossier card + orbiting Sanctuary Gold audit scan ring)
  LOTTIE_ICONS.userinspect = makeLottieDoc('edf-userinspect', [
    shapeLayer(1, 'dossier-sheet', [
      { ty: 'rc', d: 1, s: sVal([14.4, 16.0]), p: sVal([0, 0]), r: sVal(2.8) },
      fill(C.emerald500, 15),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'dossier-bust', [
      { ty: 'el', d: 1, s: sVal([3.8, 3.8]), p: sVal([-1.8, -2.6]) },
      polyPath([[-4.6, 3.6], [-3.2, 1.2], [-0.4, 1.2], [1.0, 3.6]], false),
      stroke(C.teal500, 1.45)
    ]),
    shapeLayer(3, 'inspect-lens', [
      { ty: 'el', d: 1, s: sVal([5.4, 5.4]), p: sVal([3.2, 1.8]) },
      polyPath([[5.1, 3.8], [7.2, 5.9]], false),
      fill(C.amber400, 24),
      stroke(C.amber400, 1.75)
    ], {
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 30, v: [11.2, 11.2, 0] }, { t: 60, v: [12, 12, 0] }])
    })
  ]);

  // 45. Madrasa Sanctuary Dome & Open Kitab (Class & Maktab Administration)
  LOTTIE_ICONS.madrasa = makeLottieDoc('edf-madrasa', [
    shapeLayer(1, 'madrasa-dome', [
      polyPath([[-6.8, 7.0], [-6.8, 0.2], [-4.2, -3.8], [0, -6.2], [4.2, -3.8], [6.8, 0.2], [6.8, 7.0]], true),
      fill(C.emerald500, 15),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'madrasa-book', [
      polyPath([[-4.6, 5.2], [-2.2, 3.8], [0, 5.0], [2.2, 3.8], [4.6, 5.2]], false),
      polyPath([[0, 2.2], [0, 5.8]], false),
      stroke(C.teal500, 1.5)
    ], {
      s: animVec([{ t: 0, v: [95, 95, 100] }, { t: 30, v: [108, 108, 100] }, { t: 60, v: [95, 95, 100] }])
    }),
    shapeLayer(3, 'madrasa-finial', [
      { ty: 'el', d: 1, s: sVal([3.4, 3.4]), p: sVal([0, -7.8]) },
      fill(C.amber400, 95)
    ], {
      s: animVec([{ t: 0, v: [85, 85, 100] }, { t: 30, v: [120, 120, 100] }, { t: 60, v: [85, 85, 100] }])
    })
  ]);

  // 46. Muallimah Faculty Icon (Modest Teacher Halo & Gold Wisdom Seal)
  LOTTIE_ICONS.muallimah = makeLottieDoc('edf-muallimah', [
    shapeLayer(1, 'muallimah-aura', [
      { ty: 'el', d: 1, s: sVal([15.4, 15.4]), p: sVal([0, 0]) },
      fill(C.emerald500, 12),
      stroke(C.emerald500, 1.45)
    ]),
    shapeLayer(2, 'muallimah-drape', [
      { ty: 'el', d: 1, s: sVal([4.8, 4.8]), p: sVal([0, -2.6]) },
      polyPath([[-5.4, 5.8], [-3.8, 1.4], [3.8, 1.4], [5.4, 5.8]], false),
      stroke(C.teal500, 1.55)
    ]),
    shapeLayer(3, 'muallimah-spark', [
      { ty: 'el', d: 1, s: sVal([3.6, 3.6]), p: sVal([5.4, -5.2]) },
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [84, 84, 100] }, { t: 30, v: [122, 122, 100] }, { t: 60, v: [84, 84, 100] }])
    })
  ]);

  // 47. Student Cap & Tassel (Maktab Scholar Directory)
  LOTTIE_ICONS.studentcap = makeLottieDoc('edf-studentcap', [
    shapeLayer(1, 'cap-board', [
      polyPath([[0, -6.2], [8.2, -2.0], [0, 2.2], [-8.2, -2.0]], true),
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.6)
    ]),
    shapeLayer(2, 'cap-crown', [
      polyPath([[-4.8, 0.8], [-4.8, 5.0], [0, 6.8], [4.8, 5.0], [4.8, 0.8]], false),
      stroke(C.teal500, 1.55)
    ]),
    shapeLayer(3, 'cap-tassel', [
      polyPath([[6.6, -1.2], [6.6, 4.4]], false),
      { ty: 'el', d: 1, s: sVal([2.8, 2.8]), p: sVal([6.6, 5.2]) },
      fill(C.amber400, 95),
      stroke(C.amber400, 1.6)
    ], {
      r: animScalar([{ t: 0, v: -6 }, { t: 30, v: 7 }, { t: 60, v: -6 }])
    })
  ]);

  // 48. Attendance Roll Call Clipboard (Animated Daily Register Check)
  LOTTIE_ICONS.rollcall = makeLottieDoc('edf-rollcall', [
    shapeLayer(1, 'rollcall-sheet', [
      { ty: 'rc', d: 1, s: sVal([14.2, 17.0]), p: sVal([0, 0.8]), r: sVal(2.6) },
      fill(C.emerald500, 15),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'rollcall-clasp', [
      { ty: 'rc', d: 1, s: sVal([6.4, 2.6]), p: sVal([0, -7.8]), r: sVal(1.2) },
      polyPath([[-4.0, -3.2], [4.0, -3.2]], false),
      stroke(C.teal500, 1.5)
    ]),
    shapeLayer(3, 'rollcall-check', [
      polyPath([[-3.4, 2.0], [-0.8, 4.6], [4.2, -0.8]], false),
      stroke(C.amber400, 1.95)
    ], {
      s: animVec([{ t: 0, v: [88, 88, 100] }, { t: 28, v: [116, 116, 100] }, { t: 60, v: [88, 88, 100] }])
    })
  ]);

  // 49. Bento Menu Grid (Animated 2x2 Architectural Drawer Trigger)
  LOTTIE_ICONS.menugrid = makeLottieDoc('edf-menugrid', [
    shapeLayer(1, 'mg-tl-br', [
      { ty: 'rc', d: 1, s: sVal([6.2, 6.2]), p: sVal([-4.4, -4.4]), r: sVal(1.8) },
      { ty: 'rc', d: 1, s: sVal([6.2, 6.2]), p: sVal([4.4, 4.4]), r: sVal(1.8) },
      fill(C.emerald700, 20),
      stroke(C.emerald700, 1.65)
    ], {
      s: animVec([{ t: 0, v: [94, 94, 100] }, { t: 28, v: [106, 106, 100] }, { t: 60, v: [94, 94, 100] }])
    }),
    shapeLayer(2, 'mg-tr', [
      { ty: 'rc', d: 1, s: sVal([6.2, 6.2]), p: sVal([4.4, -4.4]), r: sVal(1.8) },
      fill(C.amber400, 92),
      stroke(C.amber400, 1.45)
    ], {
      s: animVec([{ t: 0, v: [104, 104, 100] }, { t: 30, v: [86, 86, 100] }, { t: 60, v: [104, 104, 100] }])
    }),
    shapeLayer(3, 'mg-bl', [
      { ty: 'rc', d: 1, s: sVal([6.2, 6.2]), p: sVal([-4.4, 4.4]), r: sVal(1.8) },
      fill(C.teal500, 22),
      stroke(C.emerald700, 1.65)
    ])
  ]);

  // 50. Soft Floating Chevron Down (Explore Popover Trigger)
  LOTTIE_ICONS.chevrondown = makeLottieDoc('edf-chevrondown', [
    shapeLayer(1, 'chev-stroke', [
      polyPath([[-5.4, -2.2], [0, 3.4], [5.4, -2.2]], false),
      stroke(C.emerald700, 2.2)
    ], {
      p: animVec([{ t: 0, v: [12, 11.4, 0] }, { t: 30, v: [12, 13.6, 0] }, { t: 60, v: [12, 11.4, 0] }])
    })
  ]);

  // 51. Architectural Close X (Animated Emerald & Gold Cross)
  LOTTIE_ICONS.closex = makeLottieDoc('edf-closex', [
    shapeLayer(1, 'x-ring', [
      { ty: 'el', d: 1, s: sVal([18.5, 18.5]), p: sVal([0, 0]) },
      stroke(C.amber400, 1.25, 45)
    ]),
    shapeLayer(2, 'x-cross', [
      polyPath([[-4.4, -4.4], [4.4, 4.4]], false),
      polyPath([[4.4, -4.4], [-4.4, 4.4]], false),
      stroke(C.amber300, 2.0)
    ], {
      r: animScalar([{ t: 0, v: 0 }, { t: 30, v: 90 }, { t: 60, v: 0 }])
    })
  ]);

  // 52. Kinetic Arrow Up (Back to Top Ring Trigger)
  LOTTIE_ICONS.arrowup = makeLottieDoc('edf-arrowup', [
    shapeLayer(1, 'up-shaft', [
      polyPath([[0, 6.2], [0, -5.2]], false),
      stroke(C.amber300, 2.1)
    ], {
      p: animVec([{ t: 0, v: [12, 12.8, 0] }, { t: 28, v: [12, 10.6, 0] }, { t: 60, v: [12, 12.8, 0] }])
    }),
    shapeLayer(2, 'up-head', [
      polyPath([[-4.8, -0.8], [0, -5.8], [4.8, -0.8]], false),
      stroke(C.amber300, 2.2)
    ], {
      p: animVec([{ t: 0, v: [12, 12.8, 0] }, { t: 28, v: [12, 10.2, 0] }, { t: 60, v: [12, 12.8, 0] }])
    })
  ]);

  // 53. Kinetic Arrow Right (Forward & Skip Action Trigger)
  LOTTIE_ICONS.arrowright = makeLottieDoc('edf-arrowright', [
    shapeLayer(1, 'rt-shaft', [
      polyPath([[-5.8, 0], [5.2, 0]], false),
      stroke(C.amber400, 2.0)
    ], {
      p: animVec([{ t: 0, v: [11.2, 12, 0] }, { t: 28, v: [13.2, 12, 0] }, { t: 60, v: [11.2, 12, 0] }])
    }),
    shapeLayer(2, 'rt-head', [
      polyPath([[0.8, -4.6], [5.6, 0], [0.8, 4.6]], false),
      stroke(C.amber400, 2.1)
    ], {
      p: animVec([{ t: 0, v: [11.2, 12, 0] }, { t: 28, v: [13.6, 12, 0] }, { t: 60, v: [11.2, 12, 0] }])
    })
  ]);

  // 54. Founder Charter Crown (Sovereign Gold Crest for Founding Members)
  LOTTIE_ICONS.foundercrown = makeLottieDoc('edf-foundercrown', [
    shapeLayer(1, 'crown-body', [
      polyPath([[-7.2, 3.6], [-8.0, -3.2], [-3.4, 0.2], [0, -5.2], [3.4, 0.2], [8.0, -3.2], [7.2, 3.6]], true),
      fill(C.amber400, 28),
      stroke(C.amber400, 1.75)
    ], {
      s: animVec([{ t: 0, v: [97, 97, 100] }, { t: 30, v: [106, 106, 100] }, { t: 60, v: [97, 97, 100] }])
    }),
    shapeLayer(2, 'crown-base', [
      { ty: 'rc', d: 1, s: sVal([15.2, 2.5]), p: sVal([0, 6.2]), r: sVal(1.2) },
      fill(C.emerald500, 26),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(3, 'crown-jewel', [
      { ty: 'el', d: 1, s: sVal([2.5, 2.5]), p: sVal([0, -7.2]) },
      fill(C.amber300, 96)
    ], {
      s: animVec([{ t: 0, v: [84, 84, 100] }, { t: 28, v: [122, 122, 100] }, { t: 60, v: [84, 84, 100] }])
    })
  ]);

  // 55. Member Smart ID Badge (Scanning Biometric Identity Card)
  LOTTIE_ICONS.idbadge = makeLottieDoc('edf-idbadge', [
    shapeLayer(1, 'id-card-frame', [
      { ty: 'rc', d: 1, s: sVal([18.4, 13.6]), p: sVal([0, 0]), r: sVal(2.6) },
      fill(C.emerald500, 14),
      stroke(C.emerald500, 1.6)
    ]),
    shapeLayer(2, 'id-photo-box', [
      { ty: 'rc', d: 1, s: sVal([4.8, 5.8]), p: sVal([-4.4, -0.3]), r: sVal(1.3) },
      fill(C.amber400, 26),
      stroke(C.amber400, 1.35)
    ]),
    shapeLayer(3, 'id-scan-lines', [
      polyPath([[0.8, -2.6], [6.4, -2.6]], false),
      polyPath([[0.8, 0.2], [6.4, 0.2]], false),
      polyPath([[0.8, 3.0], [4.8, 3.0]], false),
      stroke(C.teal500, 1.5)
    ], {
      p: animVec([{ t: 0, v: [12, 11.4, 0] }, { t: 30, v: [12, 12.6, 0] }, { t: 60, v: [12, 11.4, 0] }])
    })
  ]);

  // 56. Member Payment History Clock Ledger (Financial History & Dues Audit)
  LOTTIE_ICONS.paymenthistory = makeLottieDoc('edf-paymenthistory', [
    shapeLayer(1, 'pmh-arc', [
      { ty: 'el', d: 1, s: sVal([16.8, 16.8]), p: sVal([0, 0]) },
      stroke(C.emerald500, 1.6)
    ]),
    shapeLayer(2, 'pmh-hands', [
      polyPath([[0, -4.4], [0, 0.4], [3.6, 2.2]], false),
      stroke(C.amber400, 1.8)
    ], {
      r: animScalar([{ t: 0, v: 0 }, { t: 30, v: 22 }, { t: 60, v: 0 }])
    }),
    shapeLayer(3, 'pmh-coin-dot', [
      { ty: 'el', d: 1, s: sVal([3.2, 3.2]), p: sVal([6.6, -6.2]) },
      fill(C.amber400, 95)
    ], {
      s: animVec([{ t: 0, v: [86, 86, 100] }, { t: 30, v: [120, 120, 100] }, { t: 60, v: [86, 86, 100] }])
    })
  ]);

  // 57. Family & Dependents Constellation (Member & Relatives Tree)
  LOTTIE_ICONS.familytree = makeLottieDoc('edf-familytree', [
    shapeLayer(1, 'fam-branches', [
      polyPath([[0, -1.8], [0, 2.0]], false),
      polyPath([[-5.4, 2.0], [5.4, 2.0]], false),
      polyPath([[-5.4, 2.0], [-5.4, 4.4]], false),
      polyPath([[5.4, 2.0], [5.4, 4.4]], false),
      stroke(C.teal500, 1.55)
    ]),
    shapeLayer(2, 'fam-guardian', [
      { ty: 'el', d: 1, s: sVal([5.2, 5.2]), p: sVal([0, -5.2]) },
      fill(C.emerald500, 26),
      stroke(C.emerald500, 1.65)
    ], {
      s: animVec([{ t: 0, v: [95, 95, 100] }, { t: 30, v: [108, 108, 100] }, { t: 60, v: [95, 95, 100] }])
    }),
    shapeLayer(3, 'fam-dependents', [
      { ty: 'el', d: 1, s: sVal([4.2, 4.2]), p: sVal([-5.4, 6.6]) },
      { ty: 'el', d: 1, s: sVal([4.2, 4.2]), p: sVal([5.4, 6.6]) },
      fill(C.amber400, 42),
      stroke(C.amber400, 1.55)
    ], {
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 30, v: [11.2, 11.2, 0] }, { t: 60, v: [12, 12, 0] }])
    })
  ]);

  // 58. Cash / Money Aid (Emerald Banknote + Floating Sanctuary Gold Coin Pulse)
  LOTTIE_ICONS.aidcash = makeLottieDoc('edf-aidcash', [
    shapeLayer(1, 'note-bill', [
      { ty: 'rc', d: 1, s: sVal([16.8, 10.6]), p: sVal([0, 1.2]), r: sVal(2.1) },
      fill(C.emerald500, 18),
      stroke(C.emerald700, 1.6)
    ], {
      s: animVec([{ t: 0, v: [98, 98, 100] }, { t: 30, v: [104, 104, 100] }, { t: 60, v: [98, 98, 100] }])
    }),
    shapeLayer(2, 'note-trim', [
      polyPath([[-5.6, -1.6], [5.6, -1.6]], false),
      polyPath([[-5.6, 4.0], [5.6, 4.0]], false),
      stroke(C.emerald500, 1.25),
      { ty: 'tm', s: sVal(0), e: animScalar([{ t: 0, v: 60 }, { t: 30, v: 100 }, { t: 60, v: 60 }]), o: sVal(0), m: 1 }
    ]),
    shapeLayer(3, 'gold-coin', [
      { ty: 'el', d: 1, s: sVal([5.2, 5.2]), p: sVal([0, 1.2]) },
      fill(C.amber400, 92),
      stroke(C.emerald900, 1.0)
    ], {
      s: animVec([{ t: 0, v: [90, 90, 100] }, { t: 28, v: [118, 118, 100] }, { t: 60, v: [90, 90, 100] }]),
      p: animVec([{ t: 0, v: [12, 12, 0] }, { t: 28, v: [12, 11.1, 0] }, { t: 60, v: [12, 12, 0] }])
    })
  ]);

  // 59. Building Repair Hammer (Swinging Golden Mallet + Structural Masonry Base)
  LOTTIE_ICONS.repairhammer = makeLottieDoc('edf-repairhammer', [
    shapeLayer(1, 'masonry-base', [
      polyPath([[-7.0, 5.8], [7.0, 5.8]], false),
      polyPath([[-4.6, 3.0], [4.6, 3.0]], false),
      stroke(C.emerald700, 1.75)
    ]),
    shapeLayer(2, 'mallet-swing', [
      polyPath([[-2.2, 3.4], [3.6, -2.4]], false),
      polyPath([[1.2, -5.0], [6.4, 0.2], [4.4, 2.2], [-0.8, -3.0]], true),
      fill(C.amber400, 88),
      stroke(C.emerald700, 1.35)
    ], {
      a: sVal([-2.2, 3.4, 0]),
      p: sVal([9.8, 15.4, 0]),
      r: animScalar([{ t: 0, v: -18 }, { t: 22, v: 14 }, { t: 40, v: -10 }, { t: 60, v: -18 }])
    }),
    shapeLayer(3, 'impact-spark', [
      polyPath([[-1.8, -1.2], [1.8, -1.2]], false),
      polyPath([[0, -2.8], [0, 0.6]], false),
      stroke(C.amber400, 1.35)
    ], {
      o: animScalar([{ t: 0, v: 20 }, { t: 22, v: 100 }, { t: 42, v: 20 }, { t: 60, v: 20 }])
    })
  ]);

  // 60. Relief Support Aid Package (Lifting Parcel Box + Rising Golden Hope Emblem)
  LOTTIE_ICONS.aidpackage = makeLottieDoc('edf-aidpackage', [
    shapeLayer(1, 'parcel-box', [
      { ty: 'rc', d: 1, s: sVal([13.6, 11.4]), p: sVal([0, 2.2]), r: sVal(2.0) },
      fill(C.emerald500, 18),
      stroke(C.emerald700, 1.6)
    ], {
      s: animVec([{ t: 0, v: [100, 100, 100] }, { t: 30, v: [105, 105, 100] }, { t: 60, v: [100, 100, 100] }])
    }),
    shapeLayer(2, 'box-ribbon', [
      polyPath([[-6.8, -0.8], [6.8, -0.8]], false),
      polyPath([[0, -3.5], [0, 7.8]], false),
      stroke(C.emerald500, 1.4)
    ]),
    shapeLayer(3, 'hope-star', [
      polyPath([[0, -7.8], [1.4, -4.6], [4.6, -3.2], [1.4, -1.8], [0, 1.4], [-1.4, -1.8], [-4.6, -3.2], [-1.4, -4.6]], true),
      fill(C.amber400, 92)
    ], {
      p: animVec([{ t: 0, v: [12, 10.6, 0] }, { t: 30, v: [12, 9.2, 0] }, { t: 60, v: [12, 10.6, 0] }]),
      s: animVec([{ t: 0, v: [82, 82, 100] }, { t: 30, v: [106, 106, 100] }, { t: 60, v: [82, 82, 100] }])
    })
  ]);

  // 61. Volunteer Field Crest (Kinetic Emerald Shield + Service Halo + Gold Khidmah Star)
  LOTTIE_ICONS.volunteerbadge = makeLottieDoc('edf-volunteerbadge', [
    shapeLayer(1, 'crest-halo', [
      { ty: 'el', d: 1, s: sVal([18.8, 18.8]), p: sVal([0, 0]) },
      stroke(C.emerald500, 1.1, animScalar([{ t: 0, v: 26 }, { t: 30, v: 64 }, { t: 60, v: 26 }])),
      { ty: 'tm', s: sVal(0), e: sVal(72), o: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }]), m: 1 }
    ]),
    shapeLayer(2, 'crest-shield', [
      polyPath([[0, -7.2], [6.2, -4.2], [5.8, 2.0], [0, 7.2], [-5.8, 2.0], [-6.2, -4.2]], true),
      fill(C.emerald500, 18),
      stroke(C.emerald500, 1.55)
    ], {
      s: animVec([{ t: 0, v: [97, 97, 100] }, { t: 30, v: [104, 104, 100] }, { t: 60, v: [97, 97, 100] }])
    }),
    shapeLayer(3, 'crest-star', [
      polyPath([[0, -4.4], [1.2, -1.6], [4.0, -0.4], [1.2, 0.8], [0, 3.6], [-1.2, 0.8], [-4.0, -0.4], [-1.2, -1.6]], true),
      fill(C.amber400, 96)
    ], {
      s: animVec([{ t: 0, v: [86, 86, 100] }, { t: 30, v: [112, 112, 100] }, { t: 60, v: [86, 86, 100] }])
    })
  ]);

  // 62. Volunteer Service Hours Clock (Orbital Dial + Sweeping Hand + Gold Milestone Pip)
  LOTTIE_ICONS.servicelog = makeLottieDoc('edf-servicelog', [
    shapeLayer(1, 'clock-ring', [
      { ty: 'el', d: 1, s: sVal([16.8, 16.8]), p: sVal([0, 0]) },
      fill(C.emerald500, 12),
      stroke(C.emerald500, 1.55)
    ]),
    shapeLayer(2, 'clock-hand', [
      polyPath([[0, 0], [0, -5.2]], false),
      stroke(C.emerald700, 1.65)
    ], {
      r: animScalar([{ t: 0, v: 0 }, { t: 60, v: 360 }])
    }),
    shapeLayer(3, 'clock-gold-hand', [
      polyPath([[0, 0], [4.0, 2.2]], false),
      { ty: 'el', d: 1, s: sVal([3.0, 3.0]), p: sVal([0, 0]) },
      fill(C.amber400, 96),
      stroke(C.amber400, 1.55)
    ], {
      s: animVec([{ t: 0, v: [95, 95, 100] }, { t: 30, v: [112, 112, 100] }, { t: 60, v: [95, 95, 100] }])
    })
  ]);

  // 63. Field Dispatch Beacon (Expanding Sonar Ring + Gold Mission Diamond)
  LOTTIE_ICONS.fielddispatch = makeLottieDoc('edf-fielddispatch', [
    shapeLayer(1, 'sonar-outer', [
      { ty: 'el', d: 1, s: sVal([18.0, 18.0]), p: sVal([0, 0]) },
      stroke(C.emerald500, 1.15, animScalar([{ t: 0, v: 70 }, { t: 45, v: 12 }, { t: 60, v: 70 }]))
    ], {
      s: animVec([{ t: 0, v: [76, 76, 100] }, { t: 60, v: [112, 112, 100] }])
    }),
    shapeLayer(2, 'sonar-inner', [
      { ty: 'el', d: 1, s: sVal([11.5, 11.5]), p: sVal([0, 0]) },
      fill(C.emerald500, 16),
      stroke(C.emerald500, 1.4)
    ]),
    shapeLayer(3, 'dispatch-diamond', [
      polyPath([[0, -4.2], [4.2, 0], [0, 4.2], [-4.2, 0]], true),
      fill(C.amber400, 96)
    ], {
      r: animScalar([{ t: 0, v: 0 }, { t: 30, v: 45 }, { t: 60, v: 0 }])
    })
  ]);

  // Fallback minimal static SVG icons if CDN lottie-web fails offline
  const FALLBACK_SVGS = {
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4" stroke="#d4af37"/></svg>',
    landmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><path d="M4 20h16M6 20v-7l6-5 6 5v7"/><path d="M10 20v-4l2-2 2 2v4" stroke="#d4af37"/></svg>',
    compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><circle cx="12" cy="12" r="9"/><polygon points="15 9 13 13 9 15 11 11 15 9" stroke="#d4af37" fill="#d4af37"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><path d="M2 6s3-2 10 1c7-3 10-1 10-1v13s-3-2-10 1c-7-3-10-1-10-1V6z"/><path d="M12 7v13" stroke="#d4af37"/></svg>',
    gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 5"/></svg>',
    community: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><circle cx="12" cy="12" r="9"/><path d="M12 8l3 3-3 4-3-4 3-3z" fill="#d4af37" stroke="none"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4" stroke="#d4af37"/></svg>',
    portal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3" stroke="#d4af37"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-full h-full"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" fill="#d4af37" stroke="none"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="#d4af37"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5v3h-5a1.5 1.5 0 010-3z" stroke="#d4af37"/></svg>',
    crescent: '<svg viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" stroke="#d4af37"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    vault: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke="#d4af37"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0" stroke="#d4af37"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><circle cx="15.5" cy="12" r="2.2" fill="#d4af37" stroke="none"/></svg>',
    qrscan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="5" y1="12" x2="19" y2="12" stroke="#d4af37" stroke-width="2.2"/></svg>',
    storefront: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><circle cx="18" cy="5" r="2" fill="#d4af37" stroke="none"/></svg>',
    charity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5l4.2 3.4L12 13 7.8 8.4 12 5z" fill="#d4af37" stroke="none"/><path d="M4.5 13.5c2 3.2 4.8 4.8 7.5 4.8s5.5-1.6 7.5-4.8"/></svg>',
    ledger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/><circle cx="16" cy="17" r="2" fill="#d4af37" stroke="none"/></svg>',
    balance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v17M7 20h10M4 7l8-2 8 2"/><circle cx="6" cy="12" r="2.2" fill="#d4af37" stroke="none"/><circle cx="18" cy="12" r="2.2" fill="#d4af37" stroke="none"/></svg>',
    smswave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5" stroke="#d4af37"/></svg>',
    homecare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M12 11.5l2.4 2.7-2.4 2.8-2.4-2.8L12 11.5z" fill="#d4af37" stroke="none"/></svg>',
    toolbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V4.8A1.8 1.8 0 0110.8 3h2.4A1.8 1.8 0 0115 4.8V7"/><path d="M3 12h18"/><rect x="10.2" y="10.2" width="3.6" height="3.6" rx="0.8" fill="#d4af37" stroke="none"/></svg>',
    docvault: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8" stroke="#d4af37"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    cloudupload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><polyline points="8 9 12 5 16 9" stroke="#d4af37"/><line x1="12" y1="5" x2="12" y2="16" stroke="#d4af37"/></svg>',
    assetbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8.5 4.9v9.8L12 22l-8.5-5.3V6.9L12 2z"/><path d="M3.5 7l8.5 5 8.5-5M12 12v10"/><path d="M8 4.4l8 4.6" stroke="#d4af37"/></svg>',
    clipcheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="3" rx="1" fill="#d4af37" stroke="none"/><path d="M8.5 12.5l2 2 5-4.5" stroke="#d4af37"/></svg>',
    members: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9.5" cy="8.5" r="3.2"/><path d="M4 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.2"/><path d="M15.5 19c2 0 3.8-1 4.5-3.2"/><circle cx="17.5" cy="5.5" r="1.6" fill="#d4af37" stroke="none"/></svg>',
    beneficiaries: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12.5c1.6 3.6 4.4 5.8 8 6.5 3.6-.7 6.4-2.9 8-6.5"/><path d="M12 6l3.8 3.2L12 13.5 8.2 9.2 12 6z" fill="#d4af37" stroke="none"/></svg>',
    volunteers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="8.5" r="3"/><path d="M5.5 19a5.5 5.5 0 0 1 11 0"/><path d="M18 5l.9 2.1L21 8l-2.1.9L18 11l-.9-2.1L15 8l2.1-.9L18 5z" fill="#d4af37" stroke="none"/></svg>',
    gradcap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.2 9 2.2 12 0v-5"/><path d="M19 11v6" stroke="#d4af37"/><circle cx="19" cy="18" r="1.4" fill="#d4af37" stroke="none"/></svg>',
    usersadmin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><circle cx="12" cy="10.5" r="2.2"/><path d="M8.2 16a4 4 0 0 1 7.6 0"/><circle cx="12" cy="6.2" r="1.4" fill="#d4af37" stroke="none"/></svg>',
    pulsewave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M5.5 12h3l2-4.5 2.5 9 2-4.5h3.5" stroke="#d4af37"/></svg>',
    profilecard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17.5a5 5 0 0 1 9 0"/><circle cx="18" cy="6" r="1.8" fill="#d4af37" stroke="none"/></svg>',
    listitems: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6.5" cy="7.5" r="1.3" fill="#d4af37" stroke="none"/><circle cx="6.5" cy="12" r="1.3" fill="#d4af37" stroke="none"/><circle cx="6.5" cy="16.5" r="1.3" fill="#d4af37" stroke="none"/><path d="M10.5 7.5h8M10.5 12h8M10.5 16.5h8"/></svg>',
    useradd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9.5" cy="8.5" r="3.2"/><path d="M4 19a5.5 5.5 0 0 1 11 0"/><path d="M18 9v6M15 12h6" stroke="#d4af37"/></svg>',
    tagbadge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.5 3H5a2 2 0 0 0-2 2v7.5l8.5 8.5 9.5-9.5L12.5 3z"/><circle cx="7.5" cy="7.5" r="1.6" fill="#d4af37" stroke="none"/></svg>',
    layoutui: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9.5 9v11"/><rect x="12" y="11.5" width="6.5" height="6" rx="1" fill="#d4af37" stroke="none"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="#d4af37" stroke="none"/><circle cx="15" cy="12" r="2" fill="#d4af37" stroke="none"/><circle cx="10.5" cy="17" r="2" fill="#d4af37" stroke="none"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.5 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6"/><path d="M10.5 12h9M16.5 8.5L20 12l-3.5 3.5" stroke="#d4af37"/></svg>',
    keylock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="14.5" r="1.8" fill="#d4af37" stroke="none"/></svg>',
    radarwave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2.2" fill="#d4af37" stroke="none"/></svg>',
    userinspect: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="14" height="18" rx="2.5"/><circle cx="10" cy="9" r="2.2"/><path d="M6.8 15.5a3.5 3.5 0 0 1 6.4 0"/><circle cx="16.5" cy="15.5" r="2.6" stroke="#d4af37"/><path d="M18.5 17.5l2.5 2.5" stroke="#d4af37"/></svg>',
    madrasa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V11l4-4 4-3 4 3 4 4v9H4z"/><path d="M8 17c1.5-1 3-1 4 0 1-1 2.5-1 4 0"/><circle cx="12" cy="2.5" r="1.4" fill="#d4af37" stroke="none"/></svg>',
    muallimah: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.5" r="2.6"/><path d="M7.5 17.5a5 5 0 0 1 9 0"/><circle cx="17.5" cy="6.5" r="1.6" fill="#d4af37" stroke="none"/></svg>',
    studentcap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M19 11v6" stroke="#d4af37"/><circle cx="19" cy="17.5" r="1.4" fill="#d4af37" stroke="none"/></svg>',
    rollcall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="3" rx="1"/><path d="M8.5 13l2.2 2.2 4.8-4.8" stroke="#d4af37"/></svg>',
    menugrid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" fill="#d4af37" stroke="#d4af37"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>',
    chevrondown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    closex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5" stroke-opacity="0.35"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>',
    arrowup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    arrowright: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
    foundercrown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 15l-1-7 5.5 3.5L12 5l3.5 6.5L21 8l-1 7H4z" stroke="#d4af37"/><rect x="4.5" y="17.5" width="15" height="2.5" rx="1"/></svg>',
    idbadge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="5.5" y="8.5" width="4.5" height="5.5" rx="1" stroke="#d4af37"/><path d="M12.5 9.5h5.5M12.5 12.5h5.5M12.5 15.5h3.5"/></svg>',
    paymenthistory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3.5 2" stroke="#d4af37"/><circle cx="18.5" cy="5.5" r="1.8" fill="#d4af37" stroke="none"/></svg>',
    familytree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="6.5" r="2.6"/><path d="M12 9.5V14M6.5 14h11M6.5 14v2.5M17.5 14v2.5"/><circle cx="6.5" cy="18.5" r="2" stroke="#d4af37"/><circle cx="17.5" cy="18.5" r="2" stroke="#d4af37"/></svg>',
    aidcash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6.5" width="18" height="11" rx="2.2"/><circle cx="12" cy="12" r="2.8" fill="#d4af37" stroke="none"/><path d="M6.5 9.5h2M15.5 14.5h2"/></svg>',
    repairhammer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.7a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0Z" fill="#d4af37" stroke="none"/><path d="M14 9l-8.5 8.5a1.5 1.5 0 0 0 2.1 2.1L16 11"/><path d="M4 20.5h16" stroke="#10b981"/></svg>',
    aidpackage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M4 12.5h16M12 8v12"/><path d="M12 3l1.3 2.7 2.7 1.3-2.7 1.3L12 11l-1.3-2.7L8 7l2.7-1.3L12 3z" fill="#d4af37" stroke="none"/></svg>',
    volunteerbadge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l6.5 3v5c0 4.6-3 7.8-6.5 9.5C8.5 18.8 5.5 15.6 5.5 11V6L12 3z"/><path d="M12 7.5l1.1 2.4 2.4 1.1-2.4 1.1L12 14.5l-1.1-2.4L8.5 11l2.4-1.1L12 7.5z" fill="#d4af37" stroke="none"/></svg>',
    servicelog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.5 2" stroke="#d4af37"/><circle cx="12" cy="12" r="1.4" fill="#d4af37" stroke="none"/></svg>',
    fielddispatch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5" stroke-opacity="0.45"/><circle cx="12" cy="12" r="5"/><polygon points="12 8.5 15.5 12 12 15.5 8.5 12" fill="#d4af37" stroke="none"/></svg>'
  };

  function _shouldAlwaysLoop(slot, prefersReduced) {
    if (prefersReduced || document.documentElement.classList.contains('no-transitions')) return false;
    const triggerMode = slot.getAttribute('data-lottie-trigger') || 'hover';
    if (triggerMode === 'loop') return true;
    return !!slot.closest('.nav-link-item.active, .nav-link.active, .nav-submenu-link.active, .settings-nav-btn.active, .rd-station-camera-btn.active, .mem-step-tab.active, .mem-tier-card.active, .vm-tab-btn.active, .bh-cat-tile.active, .vol-step-tab.active, .vv-tab-btn.active, .vol-wing-tile.active, [aria-current="page"]');
  }

  function refreshEdfLottieState() {
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionOff = prefersReduced || document.documentElement.classList.contains('no-transitions');

    document.querySelectorAll('[data-lottie-icon]').forEach((slot) => {
      const anim = slot._edfLottieAnim;
      if (!anim) return;
      const shouldLoop = _shouldAlwaysLoop(slot, prefersReduced);
      if (motionOff) {
        anim.goToAndStop(18, true);
      } else if (shouldLoop) {
        anim.setSpeed(slot.getAttribute('data-lottie-trigger') === 'loop' ? 0.8 : 0.92);
        anim.play();
      } else {
        anim.goToAndStop(18, true);
      }
    });
  }

  function initEdfLottieIcons() {
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasLottie = typeof window.lottie !== 'undefined' && typeof window.lottie.loadAnimation === 'function';

    document.querySelectorAll('[data-lottie-icon]').forEach((slot) => {
      if (slot.dataset.lottieBound === '1') return;
      slot.dataset.lottieBound = '1';

      const iconName = slot.getAttribute('data-lottie-icon');
      const animData = LOTTIE_ICONS[iconName];
      const triggerMode = slot.getAttribute('data-lottie-trigger') || 'hover';

      if (slot._edfLottieAnim && typeof slot._edfLottieAnim.destroy === 'function') {
        try { slot._edfLottieAnim.destroy(); } catch (_) {}
        slot._edfLottieAnim = null;
        slot.innerHTML = '';
      }

      if (!hasLottie || !animData) {
        slot.innerHTML = FALLBACK_SVGS[iconName] || FALLBACK_SVGS.sparkles;
        return;
      }

      // Deep clone animationData per instance to avoid cross-instance mutation in lottie-web
      const dataClone = JSON.parse(JSON.stringify(animData));
      const isAlwaysLoop = _shouldAlwaysLoop(slot, prefersReduced);

      const anim = window.lottie.loadAnimation({
        container: slot,
        renderer: 'svg',
        loop: true,
        autoplay: isAlwaysLoop,
        animationData: dataClone,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
          progressiveLoad: false
        }
      });
      slot._edfLottieAnim = anim;

      const restFrame = 18;
      if (!isAlwaysLoop) {
        anim.goToAndStop(restFrame, true);
      } else {
        anim.setSpeed(triggerMode === 'loop' ? 0.8 : 0.9);
      }

      if (prefersReduced || slot.dataset.lottieHoverBound === '1') return;
      slot.dataset.lottieHoverBound = '1';

      const interactiveParent = slot.closest('a, button, .sb-search-wrap, .mem-kpi-card, .um-kpi-card, .mem-tier-card, .mem-card, .inv-kpi-card, .bh-cat-tile, .bh-section-card, .vol-kpi-card, .vol-step-tab, .vol-card, .vv-tab-btn, .vol-wing-tile') || slot;
      const playOnInteract = (speed) => {
        const activeAnim = slot._edfLottieAnim;
        if (!activeAnim || document.documentElement.classList.contains('no-transitions')) return;
        activeAnim.setSpeed(speed);
        if (!_shouldAlwaysLoop(slot, prefersReduced)) {
          activeAnim.goToAndPlay(0, true);
        }
      };
      const stopOnLeave = () => {
        const activeAnim = slot._edfLottieAnim;
        if (!activeAnim) return;
        if (_shouldAlwaysLoop(slot, prefersReduced)) {
          activeAnim.setSpeed(0.85);
        } else {
          activeAnim.goToAndStop(restFrame, true);
        }
      };
      interactiveParent.addEventListener('mouseenter', () => playOnInteract(1.35));
      interactiveParent.addEventListener('focusin', () => playOnInteract(1.25));
      interactiveParent.addEventListener('mouseleave', stopOnLeave);
      interactiveParent.addEventListener('focusout', stopOnLeave);
    });
  }

  window.EDF_LOTTIE_DATA = LOTTIE_ICONS;
  window.initEdfLottieIcons = initEdfLottieIcons;
  window.refreshEdfLottieState = refreshEdfLottieState;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEdfLottieIcons);
  } else {
    initEdfLottieIcons();
  }
})();
