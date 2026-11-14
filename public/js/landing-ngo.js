/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EDF GALGAMUWA — SHADCN/UI INTERACTIONS, ENGAGEMENT ENGINE, COMMAND PALETTE
 * Note: EDF operates strictly as a member-sustained foundation and does not
 * solicit or accept external monetary donations.
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // Initialize Lucide icons if loaded
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 0. SHADCN SONNER-STYLE TOAST SYSTEM & HIJRI DATE BADGE
  // ──────────────────────────────────────────────────────────────────────────
  function edfToast(title, description = '', variant = 'default') {
    let toaster = document.getElementById('sonner-toaster');
    if (!toaster) {
      toaster = document.createElement('div');
      toaster.id = 'sonner-toaster';
      document.body.appendChild(toaster);
    }

    const iconHtml =
      variant === 'error'
        ? '<i class="fa-solid fa-circle-exclamation text-red-400 mt-0.5"></i>'
        : '<i class="fa-solid fa-circle-check text-amber-400 mt-0.5"></i>';

    const toast = document.createElement('div');
    toast.className = 'sonner-toast';

    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = iconHtml;

    const textWrap = document.createElement('div');
    textWrap.className = 'flex-1 min-w-0';

    const titleEl = document.createElement('div');
    titleEl.className = 'text-xs font-bold text-white leading-snug';
    titleEl.textContent = title;
    textWrap.appendChild(titleEl);

    if (description) {
      const descEl = document.createElement('div');
      descEl.className = 'text-[11px] text-emerald-200/90 mt-0.5 leading-snug';
      descEl.textContent = description;
      textWrap.appendChild(descEl);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'text-emerald-300 hover:text-white text-xs ml-2';
    closeBtn.setAttribute('aria-label', 'Dismiss');
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(iconWrap);
    toast.appendChild(textWrap);
    toast.appendChild(closeBtn);
    toaster.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3600);
  }
  window.edfToast = edfToast;

  // Dynamic Hijri Date inside Top Utility Bar
  (function initHijriDate() {
    const el = document.getElementById('hijri-date-badge');
    if (!el) return;
    try {
      const hijri = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date());
      el.textContent = hijri;
    } catch (e) {
      el.textContent = '1448 AH';
    }
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. HERO INTERACTIVE COMMUNITY ENGAGEMENT WIDGET (NON-MONETARY)
  // ──────────────────────────────────────────────────────────────────────────
  let activeEngageMode = 'membership';
  let activeEngageTrack = 'education';
  let activeHeroPledgeAmount = 'LKR 3,500';

  const ENGAGE_MODES = {
    membership: {
      tierLabel: 'Education & Community Charity Pledge',
      intent: 'zakat',
      buttonText: 'Fund This Appeal',
      note: '100% of every Zakat rupee and charity gift reaches verified students, vocational trainees, or vulnerable families — zero admin deduction.'
    },
    volunteer: {
      tierLabel: 'Field Volunteer & Educator Application',
      intent: 'volunteer',
      buttonText: 'Join as Volunteer',
      note: 'Share teaching hours, medical care, technical instruction, or field verification at our Madrasa classrooms and community drives.'
    },
    institutional: {
      tierLabel: 'Equipment & Program Sponsorship',
      intent: 'equipment',
      buttonText: 'Sponsor Equipment / Program',
      note: 'Donate sewing machines, school library sets, home repair materials, medical devices, or sponsor vocational youth apprenticeships.'
    }
  };

  const TRACK_DESCRIPTIONS = {
    education: {
      before: 'Children missing schooling or Madrasa due to household financial strain.',
      after: '100+ students supported weekly with scholarships, books & Madrasa classes.',
      membership: 'Your Zakat & Sadaqah directly funds school bags, exam tuition, Madrasa stipends, and scholarships for 100+ deserving children.',
      volunteer: 'Volunteer as a weekend academic tutor, English/Maths mentor, or Madrasa assistant supporting Galgamuwa students.',
      institutional: 'Sponsor complete classroom library sets, desks, student uniform packs, or smart-board equipment for our Education Academy.'
    },
    women: {
      before: 'Widowed & low-income mothers lacking safe, dignified income at home.',
      after: 'Trained women tailors & cottage entrepreneurs earning steady income.',
      membership: 'Donations equip mothers with domestic sewing machines, starter fabric kits, and certified tailoring instruction for lasting independence.',
      volunteer: 'Lead workshops in garment tailoring, food micro-enterprise packaging, family health literacy, or women-led household budgeting.',
      institutional: 'Donate industrial sewing machines, overlock units, or artisan showcase partnerships to expand women-owned micro-enterprises.'
    },
    youth: {
      before: 'Out-of-school youth locked into unstable seasonal daily-wage labor.',
      after: 'Certified mobile hardware & CCTV technicians launching local careers.',
      membership: 'Fund tuition-free scholarships and repair workbenches enabling unemployed youth to master mobile diagnostics and CCTV installation.',
      volunteer: 'Mentor young trainees in electronics troubleshooting, networking setups, or small-shop customer service and bookkeeping.',
      institutional: 'Provide soldering stations, test benches, CCTV kits, or paid technical apprenticeships for EDF academy graduates.'
    },
    medical: {
      before: 'Elderly neighbours and chronic patients skipping vital treatment or assistive care.',
      after: 'Home health equipment, prescription aid & mobile medical screenings.',
      membership: 'Sponsor prescription medicine funds, wheelchairs, hospital beds, and preventive health camps serving vulnerable rural households.',
      volunteer: 'Serve at free weekend health camps as a doctor, nurse, pharmacist, optometrist, or patient coordinator in Galgamuwa.',
      institutional: 'Contribute diagnostic kits, mobility wheelchairs, medical consumables, or specialist camp logistics with your hospital or pharmacy.'
    },
    seasonal: {
      before: 'Dilapidated roofs, unsafe drinking water, and empty pantries during crisis.',
      after: '240+ families assisted with home repairs, water care & food relief.',
      membership: 'Channel urgent Sadaqah and Zakat into leaking roof repairs, clean drinking-water filters, and monthly family dry-ration parcels.',
      volunteer: 'Assist field assessment officers with home damage surveys, construction coordination, ration packing, and discreet doorstep delivery.',
      institutional: 'Underwrite roofing tin sheets, cement bags, tube-well filters, or bulk dry-ration staples for rural family resilience.'
    }
  };

  function getLangBundle() {
    return window.edfI18n && typeof window.edfI18n.getBundle === 'function'
      ? window.edfI18n.getBundle()
      : null;
  }

  function updateEngageCardUI() {
    const bundle = getLangBundle();
    const modesMap = (bundle && bundle.engageModes) || ENGAGE_MODES;
    const tracksMap = (bundle && bundle.tracks) || TRACK_DESCRIPTIONS;
    const modeCfg = modesMap[activeEngageMode] || modesMap.membership || ENGAGE_MODES.membership;
    const trackMap = tracksMap[activeEngageTrack] || tracksMap.education || TRACK_DESCRIPTIONS.education;

    const statementEl = document.getElementById('engage-impact-statement');
    const modeNoteEl = document.getElementById('engage-mode-note');
    const ctaBtnText = document.getElementById('hero-engage-btn-text');
    const beforeEl = document.getElementById('hero-lens-before');
    const afterEl = document.getElementById('hero-lens-after');

    const hasStoryboard = Boolean(document.getElementById('hero-storyboard-stage'));
    if (statementEl) statementEl.textContent = trackMap[activeEngageMode] || trackMap.membership;
    if (modeNoteEl) modeNoteEl.textContent = modeCfg.note;
    if (ctaBtnText) ctaBtnText.textContent = modeCfg.buttonText;
    if (!hasStoryboard) {
      if (beforeEl && trackMap.before) beforeEl.textContent = trackMap.before;
      if (afterEl && trackMap.after) afterEl.textContent = trackMap.after;
    }

    document.querySelectorAll('.hero-lens-pill').forEach((pill) => {
      pill.classList.toggle('active', (pill.dataset.track || '') === activeEngageTrack);
    });
  }

  window.addEventListener('edf:storyboardact', (e) => {
    const nextTrack = e && e.detail && e.detail.act && e.detail.act.track;
    if (nextTrack) {
      activeEngageTrack = nextTrack;
      updateEngageCardUI();
    }
  });

  const initialPledgePill = document.querySelector('.hero-pledge-pill.active');
  if (initialPledgePill && initialPledgePill.dataset.amount) {
    activeHeroPledgeAmount = initialPledgePill.dataset.amount;
  }

  document.querySelectorAll('.hero-pledge-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      document.querySelectorAll('.hero-pledge-pill').forEach((p) => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      if (e.currentTarget.dataset.amount) {
        activeHeroPledgeAmount = e.currentTarget.dataset.amount;
      }
    });
  });

  document.querySelectorAll('.hero-lens-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      activeEngageTrack = e.currentTarget.dataset.track || 'education';
      const selectEl = document.getElementById('engage-track-select');
      if (selectEl) selectEl.value = activeEngageTrack;
      updateEngageCardUI();
    });
  });

  document.querySelectorAll('.engage-tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const darkRoleDock = Boolean(document.getElementById('hero-storyboard-stage'));
      document.querySelectorAll('.engage-tab-btn').forEach((b) => {
        if (darkRoleDock) {
          b.classList.remove('bg-amber-400', 'text-emerald-950', 'shadow-sm');
          b.classList.add('text-emerald-200/85', 'hover:text-white');
        } else {
          b.classList.remove('bg-emerald-900', 'text-amber-300', 'shadow-sm');
          b.classList.add('text-gray-600', 'hover:text-emerald-900');
        }
      });
      if (darkRoleDock) {
        e.currentTarget.classList.add('bg-amber-400', 'text-emerald-950', 'shadow-sm');
        e.currentTarget.classList.remove('text-emerald-200/85', 'hover:text-white');
      } else {
        e.currentTarget.classList.add('bg-emerald-900', 'text-amber-300', 'shadow-sm');
        e.currentTarget.classList.remove('text-gray-600', 'hover:text-emerald-900');
      }
      activeEngageMode = e.currentTarget.dataset.mode || 'membership';
      updateEngageCardUI();
    });
  });

  const trackSelect = document.getElementById('engage-track-select');
  if (trackSelect) {
    trackSelect.addEventListener('change', (e) => {
      activeEngageTrack = e.target.value;
      updateEngageCardUI();
    });
  }

  updateEngageCardUI();

  // ──────────────────────────────────────────────────────────────────────────
  // 2. 100% AMANAH ZAKAT & CHARITY ALLOCATION EXPLORER
  // ──────────────────────────────────────────────────────────────────────────
  const CHARTER_PROFILES = {
    overview: {
      title: '100% Amanah Zakat & Charity Policy',
      badge: 'Zero Admin Deduction on Zakat',
      share: '100% To Verified Recipients',
      summary: 'Every Zakat rupee contributed is strictly ring-fenced for eligible beneficiaries across education, livelihoods, shelter repair, and emergency food relief — while trustees and sustaining patrons separately cover administrative overheads.',
      metrics: [
        { label: 'Zakat Delivered To Aid', val: '100% Ring-Fenced Pool' },
        { label: 'Core Overheads Underwritten By', val: 'Trustees & Founding Patrons' },
        { label: 'Verification Standard', val: 'Field Visit + Audited Ledger' }
      ]
    },
    education: {
      title: 'Education, Madrasa & Youth Skills',
      badge: '50% Primary Allocation',
      share: '100+ Sponsored Students',
      summary: 'Dedicated to breaking generational poverty through school kits, academic scholarships, structured Madrasa & Muallimah classes, and youth mobile/CCTV technical certification.',
      metrics: [
        { label: 'Charity Pool Allocation', val: '50% Education Priority' },
        { label: 'Fees Charged To Students', val: 'LKR 0 (100% Scholarship)' },
        { label: 'Programs Covered', val: 'School Kits, Madrasa & Tech' }
      ]
    },
    livelihood: {
      title: 'Community Development & Shelter',
      badge: '30% Allocation Focus',
      share: 'Artisans, Homes & Clean Water',
      summary: 'Builds self-reliance through women’s sewing machines and cottage enterprises, critical home roof and sanitary repairs, and safe drinking-water access.',
      metrics: [
        { label: 'Charity Pool Allocation', val: '30% Development Focus' },
        { label: 'Key Programs', val: 'Sewing Guilds & Home Repairs' },
        { label: 'Lasting Outcome', val: 'Independent Family Income' }
      ]
    },
    relief: {
      title: 'Medical Aid & Family Relief',
      badge: '15% Allocation Focus',
      share: '240+ Families Assisted',
      summary: 'Delivers essential medicines, wheelchairs, rural health camps, and seasonal dry-ration food parcels with full privacy for elderly and widowed households.',
      metrics: [
        { label: 'Charity Pool Allocation', val: '15% Relief & Care' },
        { label: 'Case Vetting', val: '100% Field Home Screening' },
        { label: 'Remaining 5% Core Ops', val: 'Underwritten By Trustees' }
      ]
    }
  };

  let activeCharterKey = 'overview';

  function renderCharterExplorer(key) {
    activeCharterKey = key || 'overview';
    const bundle = getLangBundle();
    const profiles = (bundle && bundle.charterProfiles) || CHARTER_PROFILES;
    const profile = profiles[activeCharterKey] || profiles.overview || CHARTER_PROFILES.overview;
    const titleEl = document.getElementById('charter-exp-title');
    const badgeEl = document.getElementById('charter-exp-badge');
    const shareEl = document.getElementById('charter-exp-share');
    const summaryEl = document.getElementById('charter-exp-summary');
    const metricsEl = document.getElementById('charter-exp-metrics');

    if (titleEl) titleEl.textContent = profile.title;
    if (badgeEl) badgeEl.textContent = profile.badge;
    if (shareEl) shareEl.textContent = profile.share;
    if (summaryEl) summaryEl.textContent = profile.summary;
    if (metricsEl) {
      metricsEl.innerHTML = '';
      profile.metrics.forEach((m) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between text-xs pb-2.5 border-b border-emerald-200/70 last:border-b-0 last:pb-0';

        const kSpan = document.createElement('span');
        kSpan.className = 'text-gray-600 font-medium';
        kSpan.textContent = m.label;

        const vSpan = document.createElement('span');
        vSpan.className = 'font-bold text-emerald-950';
        vSpan.textContent = m.val;

        row.appendChild(kSpan);
        row.appendChild(vSpan);
        metricsEl.appendChild(row);
      });
    }
  }

  document.querySelectorAll('.charter-exp-tab').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const targetKey = e.currentTarget.dataset.charter || 'overview';
      document.querySelectorAll('.charter-exp-tab').forEach((b) => {
        b.classList.remove('bg-emerald-900', 'text-amber-300', 'shadow-xs');
        b.classList.add('text-gray-600');
      });
      e.currentTarget.classList.add('bg-emerald-900', 'text-amber-300', 'shadow-xs');
      e.currentTarget.classList.remove('text-gray-600');
      renderCharterExplorer(targetKey);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. INTERACTIVE PILLAR FILTER TABS (SHADCN TABS)
  // ──────────────────────────────────────────────────────────────────────────
  document.querySelectorAll('.pillar-filter-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const targetCat = e.currentTarget.dataset.cat || 'all';
      document.querySelectorAll('.pillar-filter-tab').forEach((t) => {
        t.classList.remove('bg-emerald-900', 'text-amber-300', 'shadow-sm');
        t.classList.add('text-gray-600', 'hover:text-emerald-950');
      });
      e.currentTarget.classList.add('bg-emerald-900', 'text-amber-300', 'shadow-sm');
      e.currentTarget.classList.remove('text-gray-600', 'hover:text-emerald-950');

      const cards = document.querySelectorAll('.pillar-card-item');
      cards.forEach((card) => {
        const cardCat = card.dataset.cat || '';
        const match = targetCat === 'all' || cardCat.includes(targetCat);
        if (match) {
          card.classList.remove('hidden');
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(card, { opacity: 0, y: 16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
          }
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MODALS, CHARTER OVERLAY & SHADCN COMMAND PALETTE (⌘K)
  // ──────────────────────────────────────────────────────────────────────────
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  function closeAllOverlays() {
    document.querySelectorAll('.modal-backdrop').forEach((m) => m.classList.add('hidden'));
    const mobileDrawer = document.getElementById('mobile-menu-drawer');
    if (mobileDrawer) mobileDrawer.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
  }

  function openMembershipModal(tierLabel = 'Charity Contribution & Sponsorship', opts = {}) {
    const memModal = document.getElementById('membership-modal');
    const tierDisplay = document.getElementById('mem-tier-title');
    const intentSel = document.getElementById('mem-intent-select');
    const amountInput = document.getElementById('mem-amount');

    if (tierDisplay) tierDisplay.textContent = tierLabel;

    if (intentSel) {
      const explicitIntent = String(opts.intent || '').toLowerCase();
      const lowerTier = String(tierLabel || '').toLowerCase();
      const normalizedExplicit = explicitIntent === 'donation' ? 'sadaqah' : explicitIntent;
      const guessed = normalizedExplicit
        || (lowerTier.includes('volunteer') ? 'volunteer'
        : (lowerTier.includes('patron') || lowerTier.includes('steward') ? 'patron'
        : (lowerTier.includes('student') || lowerTier.includes('madrasa') || lowerTier.includes('school') || lowerTier.includes('classroom') || lowerTier.includes('education') ? 'education'
        : (lowerTier.includes('equipment') || lowerTier.includes('machine') || lowerTier.includes('repair') || lowerTier.includes('toolkit') ? 'equipment'
        : (lowerTier.includes('zakat') ? 'zakat' : 'sadaqah')))));
      const matched = Array.from(intentSel.options).find((o) =>
        o.value.toLowerCase().includes(guessed) || o.textContent.toLowerCase().includes(guessed)
      );
      if (matched) intentSel.value = matched.value;
    }

    if (amountInput) {
      if (opts.amount !== undefined && opts.amount !== null && String(opts.amount).trim() !== '') {
        amountInput.value = String(opts.amount).trim();
      } else if (!amountInput.value) {
        amountInput.value = '';
      }
    }

    if (memModal) {
      memModal.dataset.tier = tierLabel;
      memModal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  const heroEngageBtn = document.getElementById('hero-engage-btn');
  if (heroEngageBtn) {
    heroEngageBtn.addEventListener('click', () => {
      const bundle = getLangBundle();
      const modesMap = (bundle && bundle.engageModes) || ENGAGE_MODES;
      const cfg = modesMap[activeEngageMode] || modesMap.membership || ENGAGE_MODES.membership;
      const trackSelectEl = document.getElementById('engage-track-select');
      const trackName = trackSelectEl && trackSelectEl.selectedOptions && trackSelectEl.selectedOptions[0]
        ? trackSelectEl.selectedOptions[0].textContent.trim()
        : activeEngageTrack;
      const label = activeEngageMode === 'membership'
        ? `${cfg.tierLabel} · ${trackName}`
        : `${cfg.tierLabel} (${trackName})`;
      openMembershipModal(label, {
        intent: (ENGAGE_MODES[activeEngageMode] && ENGAGE_MODES[activeEngageMode].intent) || '',
        amount: activeEngageMode === 'volunteer' ? '' : activeHeroPledgeAmount
      });
    });
  }

  document.querySelectorAll('.apply-membership-btn, .open-inquiry-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      const tier = el.dataset.tier || 'Charity & Education Appeal';
      const intent = el.dataset.intent || '';
      const amount = el.dataset.amount || '';
      openMembershipModal(tier, { intent, amount });
    });
  });

  document.querySelectorAll('.open-charter-modal-btn').forEach((btn) => {
    btn.addEventListener('click', () => openModal('charter-modal'));
  });

  document.querySelectorAll('.close-modal-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.currentTarget.closest('.modal-backdrop');
      if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }
    });
  });

  // Command Palette (⌘K)
  const cmdModal = document.getElementById('cmd-palette-modal');
  const cmdInput = document.getElementById('cmd-search-input');

  function openCmdPalette() {
    if (!cmdModal) return;
    cmdModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    if (cmdInput) {
      cmdInput.value = '';
      filterCmdItems('');
      setTimeout(() => cmdInput.focus(), 60);
    }
  }

  function filterCmdItems(q) {
    const query = q.trim().toLowerCase();
    document.querySelectorAll('.cmd-item').forEach((item) => {
      const text = (item.textContent || '').toLowerCase();
      item.classList.toggle('hidden', query !== '' && !text.includes(query));
    });
  }

  document.querySelectorAll('.open-cmd-palette-btn').forEach((btn) => {
    btn.addEventListener('click', openCmdPalette);
  });

  if (cmdInput) {
    cmdInput.addEventListener('input', (e) => filterCmdItems(e.target.value));
  }

  document.querySelectorAll('.cmd-action-item').forEach((item) => {
    item.addEventListener('click', () => {
      closeModal('cmd-palette-modal');
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (cmdModal && !cmdModal.classList.contains('hidden')) {
        closeModal('cmd-palette-modal');
      } else {
        openCmdPalette();
      }
    } else if (e.key === 'Escape') {
      closeAllOverlays();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. CMS & FRONTDESK API INTEGRATION (Logo, Content, Partners, Gallery)
  // ──────────────────────────────────────────────────────────────────────────
  fetch('/api/frontdesk/logo')
    .then((r) => r.json())
    .then((data) => {
      if (data && data.url) {
        document.querySelectorAll('.brand-logo-img').forEach((img) => {
          img.src = data.url;
        });
      }
    })
    .catch(() => {});

  fetch('/api/frontdesk/content/homepage')
    .then((r) => r.json())
    .then((d) => {
      if (!d || typeof d !== 'object') return;
      const setVal = (id, key) => {
        if (d[key]) {
          const el = document.getElementById(id);
          if (el) el.textContent = d[key];
        }
      };
      setVal('hero-pill-text', 'hero.founding');
      setVal('hero-sub', 'hero.sub');
      setVal('cta-donate-text', 'hero.cta');
      setVal('hstat-1-val', 'stat1.val');
      setVal('hstat-1-lbl', 'stat1.lbl');
      setVal('hstat-2-val', 'stat2.val');
      setVal('hstat-2-lbl', 'stat2.lbl');
      setVal('hstat-3-val', 'stat3.val');
      setVal('hstat-3-lbl', 'stat3.lbl');
      setVal('join-sub-text', 'join.sub');
      setVal('join-member-count', 'join.count');
    })
    .catch(() => {});

  const DEFAULT_PARTNERS = [
    { name: 'Local Government — Galgamuwa' },
    { name: 'M.K.C. Trade Center' },
    { name: 'Union Hardware' },
    { name: 'Fancy House' },
    { name: 'Regal Groups' },
    { name: 'Hellotel' },
    { name: 'Galgamuwa Education Circle' },
    { name: 'Community Welfare Council' }
  ];

  function renderPartners(list) {
    const row = document.getElementById('partners-marquee-row');
    if (!row) return;
    const items = Array.isArray(list) && list.length ? list : DEFAULT_PARTNERS;
    const tpl = (p) => `
      <div class="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white border border-emerald-900/10 text-emerald-950 font-semibold text-sm shadow-xs whitespace-nowrap">
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        ${p.name}
      </div>`;
    row.innerHTML = items.map(tpl).join('') + items.map(tpl).join('');
  }

  renderPartners(DEFAULT_PARTNERS);
  fetch('/api/frontdesk/partners')
    .then((r) => r.json())
    .then((partners) => {
      if (Array.isArray(partners) && partners.length) renderPartners(partners);
    })
    .catch(() => {});

  const DEFAULT_GALLERY = [
    {
      filename: 'gallery-1776166775396-982798928.jpg',
      category: 'ramadan',
      caption: 'Ramadan Ration Pack Distribution',
      detail: 'Member-funded dry food packs delivered to rural families in Galgamuwa'
    },
    {
      fallbackUrl: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
      category: 'education',
      caption: 'Quran & Academic Class Session',
      detail: 'Equipping young students with essential knowledge and Islamic moral values'
    },
    {
      fallbackUrl: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80',
      category: 'education',
      caption: 'Higher Education & School Kits',
      detail: 'Providing stationery, textbooks and tutoring support for children'
    },
    {
      fallbackUrl: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=800&q=80',
      category: 'women',
      caption: "Women's Vocational Tailoring Workshop",
      detail: 'Empowering mothers with sewing skills for household self-reliance'
    },
    {
      fallbackUrl: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=800&q=80',
      category: 'livelihood',
      caption: 'Youth Technical Training Camp',
      detail: 'Hands-on training in mobile repair and practical electrical trade'
    },
    {
      fallbackUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=800&q=80',
      category: 'community',
      caption: 'Community Health & Elder Support Drive',
      detail: 'Free health consultations and essential wellness support'
    }
  ];

  let currentGalleryItems = DEFAULT_GALLERY;

  function renderGalleryGrid(category = 'all') {
    const grid = document.getElementById('home-gallery-grid');
    if (!grid) return;

    const filtered = category === 'all'
      ? currentGalleryItems
      : currentGalleryItems.filter((item) => (item.category || '').toLowerCase() === category.toLowerCase());

    if (!filtered.length) {
      grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500 font-medium">No moments found in this category.</div>`;
      return;
    }

    grid.innerHTML = filtered.map((item, idx) => {
      const imgSrc = item.filename ? `/uploads/gallery/${item.filename}` : (item.fallbackUrl || '');
      const caption = item.caption || 'Community Field Work';
      const detail = item.detail || 'EDF Galgamuwa Grassroots Initiative';
      const cat = (item.category || 'Initiative').toUpperCase();

      return `
        <div class="gallery-card group relative overflow-hidden rounded-2xl bg-emerald-950 shadow-md border border-emerald-900/15 cursor-pointer transform transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl" data-index="${idx}">
          <div class="aspect-4/3 w-full overflow-hidden bg-emerald-950/40 relative">
            <img src="${imgSrc}" alt="${caption}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80'">
            <div class="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/30 to-transparent opacity-85 group-hover:opacity-95 transition-opacity"></div>
            <div class="absolute top-3 left-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/80 backdrop-blur-md text-amber-300 border border-amber-400/30">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> ${cat}
              </span>
            </div>
            <div class="absolute bottom-3 left-3 right-3 text-white">
              <h4 class="font-serif font-bold text-base md:text-lg leading-tight mb-1 group-hover:text-amber-300 transition-colors">${caption}</h4>
              <p class="text-xs text-emerald-100/80 line-clamp-2">${detail}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.gallery-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        const item = filtered[index];
        if (!item) return;
        const lightbox = document.getElementById('lightbox-modal');
        const lbImg = document.getElementById('lightbox-img');
        const lbCap = document.getElementById('lightbox-caption');
        const lbDetail = document.getElementById('lightbox-detail');
        if (lightbox && lbImg) {
          lbImg.src = item.filename ? `/uploads/gallery/${item.filename}` : item.fallbackUrl;
          if (lbCap) lbCap.textContent = item.caption || '';
          if (lbDetail) lbDetail.textContent = item.detail || '';
          lightbox.classList.remove('hidden');
          document.body.classList.add('overflow-hidden');
        }
      });
    });
  }

  fetch('/api/frontdesk/gallery')
    .then((r) => r.json())
    .then((imgs) => {
      if (Array.isArray(imgs) && imgs.length > 0) {
        currentGalleryItems = imgs;
      }
      renderGalleryGrid('all');
    })
    .catch(() => renderGalleryGrid('all'));

  document.querySelectorAll('.gal-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.gal-filter-btn').forEach((b) => {
        b.classList.remove('bg-emerald-900', 'text-amber-300', 'border-amber-400');
        b.classList.add('bg-white', 'text-gray-700', 'border-gray-200');
      });
      e.currentTarget.classList.add('bg-emerald-900', 'text-amber-300', 'border-amber-400');
      e.currentTarget.classList.remove('bg-white', 'text-gray-700', 'border-gray-200');
      renderGalleryGrid(e.currentTarget.dataset.cat);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. SWIPER INITIALIZATIONS
  // ──────────────────────────────────────────────────────────────────────────
  let storiesSwiper = null;
  let initiativesSwiper = null;

  if (typeof Swiper !== 'undefined') {
    if (document.querySelector('.stories-swiper')) {
      storiesSwiper = new Swiper('.stories-swiper', {
        slidesPerView: 1,
        spaceBetween: 24,
        loop: true,
        autoplay: { delay: 5000, disableOnInteraction: false },
        pagination: { el: '.stories-pagination', clickable: true },
        navigation: { nextEl: '.stories-next', prevEl: '.stories-prev' },
        breakpoints: {
          640: { slidesPerView: 1.5, spaceBetween: 24 },
          1024: { slidesPerView: 2.5, spaceBetween: 30 }
        }
      });
    }

    if (document.querySelector('.initiatives-swiper')) {
      initiativesSwiper = new Swiper('.initiatives-swiper', {
        slidesPerView: 1,
        spaceBetween: 24,
        loop: true,
        pagination: { el: '.initiatives-pagination', clickable: true },
        breakpoints: {
          768: { slidesPerView: 2, spaceBetween: 24 },
          1200: { slidesPerView: 3, spaceBetween: 28 }
        }
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6B. PRIORITY APPEALS CATEGORY FILTER & ZAKAT / SADAQAH IMPACT ESTIMATOR
  // ──────────────────────────────────────────────────────────────────────────
  const appealFilterBtns = Array.from(document.querySelectorAll('.appeal-filter-btn'));
  const appealCards = Array.from(document.querySelectorAll('.appeal-card-item'));
  if (appealFilterBtns.length && appealCards.length) {
    appealFilterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.dataset.appealCat || 'all';
        appealFilterBtns.forEach((b) => {
          const isActive = b === e.currentTarget;
          b.classList.toggle('bg-emerald-950', isActive);
          b.classList.toggle('text-amber-300', isActive);
          b.classList.toggle('shadow-sm', isActive);
          b.classList.toggle('bg-white', !isActive);
          b.classList.toggle('text-emerald-950/75', !isActive);
          b.classList.toggle('border', !isActive);
          b.classList.toggle('border-stone-200', !isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        appealCards.forEach((card) => {
          const cardCat = card.dataset.appealCat || 'all';
          const show = cat === 'all' || cardCat === cat;
          card.classList.toggle('hidden', !show);
        });
      });
    });
  }

  const zakatWealthInput = document.getElementById('zakat-wealth-input');
  const zakatDueOutput = document.getElementById('zakat-due-output');
  const zakatImpactSummary = document.getElementById('zakat-impact-summary');
  const zakatPledgeBtn = document.getElementById('zakat-pledge-cta-btn');
  const zakatCalcPills = Array.from(document.querySelectorAll('.zakat-calc-pill'));

  const ZAKAT_PILL_IMPACT = {
    3500: 'LKR 3,500 equips 1 vulnerable student with a full-year school uniform, bag, books & stationery kit.',
    15000: 'LKR 15,000 sponsors a 3-month youth mobile-repair or CCTV vocational toolkit & training seat.',
    25000: 'LKR 25,000 repairs a leaking roof or installs household clean water filtration for a vulnerable family.',
    50000: 'LKR 50,000 funds a domestic sewing machine & tailoring guild starter loom for a widowed household.'
  };

  function formatLkr(num) {
    return 'LKR ' + Math.round(num).toLocaleString('en-US');
  }

  function updateZakatImpactMessage(amount) {
    if (!zakatImpactSummary || !amount || amount <= 0) return;
    if (ZAKAT_PILL_IMPACT[amount]) {
      zakatImpactSummary.textContent = ZAKAT_PILL_IMPACT[amount];
      return;
    }
    const kits = Math.max(1, Math.floor(amount / 3500));
    const packs = Math.floor(amount / 6500);
    zakatImpactSummary.textContent = packs >= 1
      ? `${formatLkr(amount)} can fund ${kits} student school kits or ${packs} emergency family relief packs (100% Amanah).`
      : `${formatLkr(amount)} goes 100% toward student tuition aid & essential classroom stationery.`;
  }

  if (zakatWealthInput && zakatDueOutput) {
    const computeZakatDue = () => {
      const raw = parseFloat(zakatWealthInput.value);
      const wealth = Number.isFinite(raw) && raw > 0 ? raw : 0;
      const due = Math.round(wealth * 0.025);
      zakatDueOutput.textContent = due > 0 ? formatLkr(due) : 'LKR 0';
      if (zakatPledgeBtn && due > 0) {
        zakatPledgeBtn.dataset.amount = formatLkr(due);
        zakatPledgeBtn.dataset.tier = '2.5% Zakat Obligation Pledge';
        zakatPledgeBtn.dataset.intent = 'zakat';
      }
      if (due > 0) {
        updateZakatImpactMessage(due);
      }
    };
    zakatWealthInput.addEventListener('input', computeZakatDue);
  }

  if (zakatCalcPills.length) {
    zakatCalcPills.forEach((pill) => {
      pill.addEventListener('click', (e) => {
        zakatCalcPills.forEach((p) => p.classList.remove('is-selected'));
        e.currentTarget.classList.add('is-selected');
        const amt = parseInt(e.currentTarget.dataset.pledge || '3500', 10) || 3500;
        if (zakatDueOutput) zakatDueOutput.textContent = formatLkr(amt);
        if (zakatPledgeBtn) {
          zakatPledgeBtn.dataset.amount = formatLkr(amt);
          zakatPledgeBtn.dataset.tier = `Sadaqah / Zakat Gift (${formatLkr(amt)})`;
          zakatPledgeBtn.dataset.intent = 'zakat';
        }
        updateZakatImpactMessage(amt);
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. CHARITY PLEDGE, VOLUNTEER & PATRONSHIP MODAL (WHATSAPP DESK)
  // ──────────────────────────────────────────────────────────────────────────
  const sendMembershipBtn = document.getElementById('mem-submit-btn');
  if (sendMembershipBtn) {
    sendMembershipBtn.addEventListener('click', () => {
      const modal = document.getElementById('membership-modal');
      const tier = modal?.dataset.tier || 'Charity Contribution & Sponsorship';
      const intentSel = document.getElementById('mem-intent-select');
      const intentLabel = intentSel && intentSel.selectedOptions && intentSel.selectedOptions[0]
        ? intentSel.selectedOptions[0].textContent.trim()
        : (intentSel?.value || '');
      const amount = document.getElementById('mem-amount')?.value.trim() || '';
      const name = document.getElementById('mem-name')?.value.trim() || '';
      const phone = document.getElementById('mem-phone')?.value.trim() || '';
      const area = document.getElementById('mem-nic')?.value.trim() || '';
      const city = document.getElementById('mem-city')?.value.trim() || 'Galgamuwa';

      if (!name || !phone) {
        edfToast('Required Details Missing', 'Please enter your full name and phone number.', 'error');
        return;
      }

      let msg = `*EDF GALGAMUWA — CHARITY & DEVELOPMENT DESK*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `⭐ *Appeal / Role:* ${tier}\n`;
      if (intentLabel) msg += `🤲 *Support Channel:* ${intentLabel}\n`;
      if (amount) msg += `💰 *Pledge / Quantity:* ${amount}\n`;
      msg += `👤 *Full Name:* ${name}\n`;
      msg += `📞 *Phone/WhatsApp:* ${phone}\n`;
      if (area) msg += `🛠️ *Note / Skill:* ${area}\n`;
      msg += `📍 *City / Area:* ${city}\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Assalamu Alaikum, I would like to coordinate this contribution/participation with EDF Galgamuwa (${tier}). Jazakumullahu Khairan!`;

      window.open(`https://wa.me/94715358380?text=${encodeURIComponent(msg)}`, '_blank');
      closeModal('membership-modal');
      edfToast('Pledge Ready', 'Opening official WhatsApp Charity Desk.');
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. MOBILE DRAWER, SCROLL-SPY GLIDE NAVBAR & BACK-TO-TOP PROGRESS RING
  // ──────────────────────────────────────────────────────────────────────────
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileDrawer = document.getElementById('mobile-menu-drawer');
  const mobileClose = document.getElementById('mobile-menu-close');

  const closeMobileDrawer = () => {
    if (!mobileDrawer) return;
    mobileDrawer.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
  };

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.remove('translate-x-full');
      document.body.classList.add('overflow-hidden');
    });
  }

  if (mobileClose && mobileDrawer) {
    mobileClose.addEventListener('click', closeMobileDrawer);
  }

  if (mobileDrawer) {
    mobileDrawer.addEventListener('click', (e) => {
      if (e.target === mobileDrawer) closeMobileDrawer();
    });
  }

  document.querySelectorAll('.mobile-nav-link').forEach((link) => {
    link.addEventListener('click', closeMobileDrawer);
  });

  const navbar = document.getElementById('main-navbar');
  const navScrollFill = document.getElementById('nav-scroll-fill');
  const backToTop = document.getElementById('backToTop');
  const bttRing = document.getElementById('btt-progress-ring');

  // Floating Navbar Glide Pill Indicator (#nav-hover-indicator) + Scroll-Spy Active Section
  const navPillGroup = document.querySelector('.nav-pill-group');
  const navHoverIndicator = document.getElementById('nav-hover-indicator');
  const navSectionLinks = navPillGroup
    ? Array.from(navPillGroup.querySelectorAll('[data-nav-section]'))
    : [];

  let isPointerInsideNav = false;

  const moveIndicatorTo = (el) => {
    if (!navPillGroup || !navHoverIndicator) return;
    if (!el) {
      navHoverIndicator.style.opacity = '0';
      return;
    }
    const gRect = navPillGroup.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    if (eRect.width <= 0) return;
    navHoverIndicator.style.width = eRect.width + 'px';
    navHoverIndicator.style.transform = `translateX(${eRect.left - gRect.left}px)`;
    navHoverIndicator.style.opacity = '1';
  };

  const restoreActiveNavIndicator = () => {
    if (!navPillGroup) return;
    const activeEl = navPillGroup.querySelector('.nav-link-item.active, .nav-link-item[aria-current="page"]');
    moveIndicatorTo(activeEl || null);
  };

  if (navPillGroup && navHoverIndicator) {
    navPillGroup.querySelectorAll('.nav-link-item, #nav-more-btn').forEach((item) => {
      item.addEventListener('mouseenter', () => {
        isPointerInsideNav = true;
        moveIndicatorTo(item);
      });
      item.addEventListener('focus', () => moveIndicatorTo(item));
    });
    navPillGroup.addEventListener('mouseleave', () => {
      isPointerInsideNav = false;
      restoreActiveNavIndicator();
    });
    window.addEventListener('resize', () => {
      if (!isPointerInsideNav) restoreActiveNavIndicator();
    }, { passive: true });
    // Sync indicator when language changes resize nav labels
    document.querySelectorAll('.lang-switch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setTimeout(() => {
          if (!isPointerInsideNav) restoreActiveNavIndicator();
        }, 40);
      });
    });
  }

  // Unique Navbar Explore Bento Popover (#nav-more-btn / #nav-more-menu)
  const navMoreBtn = document.getElementById('nav-more-btn');
  const navMoreMenu = document.getElementById('nav-more-menu');
  if (navMoreBtn && navMoreMenu) {
    const closeMoreMenu = () => {
      navMoreMenu.classList.remove('open');
      navMoreBtn.setAttribute('aria-expanded', 'false');
    };
    navMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !navMoreMenu.classList.contains('open');
      navMoreMenu.classList.toggle('open', willOpen);
      navMoreBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    navMoreMenu.querySelectorAll('a, button:not(.lang-switch-btn)').forEach((el) => {
      el.addEventListener('click', closeMoreMenu);
    });
    document.addEventListener('click', (e) => {
      if (!navMoreMenu.contains(e.target) && !navMoreBtn.contains(e.target)) {
        closeMoreMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMoreMenu();
        closeMobileDrawer();
      }
    });
  }

  let lastSpyId = '';
  const updateScrollSpyNav = () => {
    if (!navSectionLinks.length) return;
    let activeId = '';
    if (window.scrollY >= 120) {
      const triggerLine = 195;
      navSectionLinks.forEach((link) => {
        const targetId = link.getAttribute('data-nav-section');
        const sec = targetId ? document.getElementById(targetId) : null;
        if (!sec) return;
        const rect = sec.getBoundingClientRect();
        if (rect.top <= triggerLine) {
          activeId = targetId;
        }
      });
    }

    if (activeId !== lastSpyId) {
      lastSpyId = activeId;
      navSectionLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('data-nav-section') === activeId);
      });
      if (!isPointerInsideNav) restoreActiveNavIndicator();
      if (typeof window.refreshEdfLottieState === 'function') {
        window.refreshEdfLottieState();
      }
    }
  };

  window.addEventListener('scroll', () => {
    const top = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollRatio = docHeight > 0 ? Math.min(1, Math.max(0, top / docHeight)) : 0;

    if (navbar) {
      navbar.classList.toggle('navbar-floating', top > 36);
    }

    if (navScrollFill) {
      navScrollFill.style.width = (scrollRatio * 100).toFixed(1) + '%';
    }

    if (backToTop) {
      backToTop.classList.toggle('visible', top > 380);
    }

    if (bttRing) {
      const len = 125.6; // 2 * PI * 20
      bttRing.style.strokeDashoffset = String(len * (1 - scrollRatio));
    }

    updateScrollSpyNav();
  }, { passive: true });
  setTimeout(updateScrollSpyNav, 120);

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const nlForm = document.getElementById('footer-newsletter-form');
  if (nlForm) {
    nlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = nlForm.querySelector('input[type="email"]');
      if (input && input.value) {
        edfToast('Jazakallahu Khairan!', 'Subscribed to EDF Galgamuwa community field updates.');
        input.value = '';
      }
    });
  }

  updateEngageCardUI();
  renderCharterExplorer('overview');

  window.addEventListener('edf:langchange', (e) => {
    updateEngageCardUI();
    renderCharterExplorer(activeCharterKey);
    const dir = e && e.detail && e.detail.isRtl ? 'rtl' : 'ltr';
    [storiesSwiper, initiativesSwiper].forEach((sw) => {
      if (sw && typeof sw.changeLanguageDirection === 'function') {
        try {
          sw.changeLanguageDirection(dir);
          sw.update();
        } catch (err) {}
      }
    });
  });
})();
