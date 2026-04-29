/**
 * ══════════════════════════════════════════════════════
 *  MINISTRY OF MECHANICAL AFFAIRS — script.js
 *  Main interaction engine for the landing page
 * ══════════════════════════════════════════════════════
 */

/* ── 1. NAVBAR SCROLL EFFECT ── */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  const solidBg   = 'rgba(8,8,8,0.96)';
  const glassBg   = 'transparent';
  const solidBdr  = '1px solid #1A1A1A';

  function onScroll() {
    if (window.scrollY > 60) {
      navbar.style.background    = solidBg;
      navbar.style.borderBottom  = solidBdr;
      navbar.style.backdropFilter = 'blur(10px)';
    } else {
      navbar.style.background    = glassBg;
      navbar.style.borderBottom  = 'none';
      navbar.style.backdropFilter = 'none';
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
})();


/* ── 2. MOBILE MENU TOGGLE ── */
(function initMobileMenu() {
  const btn  = document.getElementById('menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    // Animate hamburger bars
    const bars = btn.querySelectorAll('span');
    if (!isOpen) {
      bars[0].style.transform = 'rotate(45deg) translate(4px, 4px)';
      bars[1].style.opacity   = '0';
      bars[2].style.transform = 'rotate(-45deg) translate(4px, -4px)';
    } else {
      bars.forEach(b => { b.style.transform = ''; b.style.opacity = ''; });
    }
  });
})();


/* ── 3. HERO PARTICLE SYSTEM ── */
(function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;

  const COUNT = 30;
  const frag  = document.createDocumentFragment();

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'particle';

    const size = Math.random() * 2 + 1;
    const x    = Math.random() * 100;
    const y    = Math.random() * 100;
    const dur  = (Math.random() * 3 + 2).toFixed(2);
    const delay = (Math.random() * 4).toFixed(2);

    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      top: ${y}%;
      opacity: ${Math.random() * 0.4 + 0.1};
      --dur: ${dur}s;
      animation-delay: ${delay}s;
    `;
    frag.appendChild(el);
  }

  container.appendChild(frag);
})();


/* ── 4. COUNT-UP ANIMATION ── */
(function initCountUp() {
  const targets = [
    { id: 'count-members', target: 47, suffix: '+' },
  ];

  function countUp(el, target, suffix = '') {
    let current  = 0;
    const step   = Math.ceil(target / 60);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current + suffix;
      if (current >= target) clearInterval(timer);
    }, 30);
  }

  // Trigger when element enters viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const conf = targets.find(t => t.id === el.id);
      if (conf) countUp(el, conf.target, conf.suffix || '');
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  targets.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();


/* ── 5. SCROLL REVEAL ── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
})();


/* ── 6. CTA BUTTON RIPPLE EFFECT ── */
(function initRipple() {
  document.querySelectorAll('.btn-cta').forEach(btn => {
    btn.addEventListener('click', function(e) {
      // Create ripple
      const rect   = this.getBoundingClientRect();
      const x      = e.clientX - rect.left;
      const y      = e.clientY - rect.top;
      const circle = document.createElement('span');
      const size   = Math.max(rect.width, rect.height) * 2;

      circle.className = 'ripple-circle';
      circle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x - size / 2}px;
        top: ${y - size / 2}px;
      `;

      this.appendChild(circle);
      setTimeout(() => circle.remove(), 700);
    });
  });
})();


/* ── 7. EASTER EGG (Logo click × 5) ── */
(function initEasterEgg() {
  const logoEl    = document.getElementById('logo-click');
  const modal     = document.getElementById('easter-modal');
  const closeBtn  = document.getElementById('easter-close');
  const easterTxt = document.getElementById('easter-text');

  if (!logoEl || !modal) return;

  let clicks = 0;
  let resetTimer;

  logoEl.addEventListener('click', () => {
    clicks++;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { clicks = 0; }, 3000);

    // Visual feedback on each click
    const gear = document.getElementById('nav-gear');
    if (gear) {
      gear.style.filter = `drop-shadow(0 0 ${clicks * 3}px #C9A84C)`;
    }

    if (clicks >= 5) {
      clicks = 0;
      clearTimeout(resetTimer);

      // Trigger glitch animation on text
      if (easterTxt) {
        easterTxt.classList.remove('glitch-text');
        // Force reflow
        void easterTxt.offsetWidth;
        easterTxt.classList.add('glitch-text');
      }

      modal.classList.add('show');
      document.body.style.overflow = 'hidden';

      if (gear) gear.style.filter = '';
    }
  });

  // Close modal
  function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
})();


/* ── 8. HERO HEADING TYPEWRITER (subtle char-by-char reveal on load) ── */
(function initHeroReveal() {
  // Stagger animate all elements with animation-delay set in HTML
  const animated = document.querySelectorAll('[style*="animation-delay"]');
  animated.forEach(el => {
    // Elements with opacity:0 in style will auto-animate
    // Just ensure animation fills forward
    if (el.style.opacity === '0') {
      el.style.animationFillMode = 'forwards';
    }
  });
})();


/* ── 9. SMOOTH ANCHOR SCROLL ── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();


/* ── 10. NAV GEAR MICRO-SPIN ON HOVER ── */
(function initGearHover() {
  const logoEl = document.getElementById('logo-click');
  const gear   = document.getElementById('nav-gear');
  if (!logoEl || !gear) return;

  logoEl.addEventListener('mouseenter', () => {
    gear.style.transition = 'filter 0.3s';
    gear.style.filter = 'drop-shadow(0 0 6px #C9A84C88)';
  });

  logoEl.addEventListener('mouseleave', () => {
    gear.style.filter = '';
  });
})();


/* ── 11. HERO SCAN-LINE: make it golden on hover ── */
(function initHeroScan() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  // Tilt subtle parallax on mouse move (desktop only)
  if (window.matchMedia('(hover: hover)').matches) {
    hero.addEventListener('mousemove', (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const xPct = (clientX / innerWidth  - 0.5) * 2;  // -1 to 1
      const yPct = (clientY / innerHeight - 0.5) * 2;

      const gears = hero.querySelectorAll('.gear-container svg');
      gears.forEach((g, i) => {
        const factor = (i + 1) * 6;
        g.style.transform = `translate(${xPct * factor}px, ${yPct * factor}px)`;
        g.style.transition = 'transform 0.4s ease';
      });
    });
  }
})();


/* ── 12. ACTIVE NAV HIGHLIGHT based on scroll ── */
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => {
          const href = l.getAttribute('href');
          if (href && href.includes(entry.target.id)) {
            l.classList.add('active');
          } else {
            l.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => observer.observe(s));
})();


/* ── 13. CONSOLE SIGNATURE ── */
console.log(
  '%c⚙ MINISTRY OF MECHANICAL AFFAIRS ⚙\n%c:: SYSTEM INITIALISED :: ALL MODULES ONLINE ::\n%cAccess Level: Engineer-Initiate',
  'color: #C9A84C; font-family: monospace; font-size: 16px; font-weight: bold;',
  'color: #8A6A2A; font-family: monospace; font-size: 11px;',
  'color: #4A3A1A; font-family: monospace; font-size: 10px;'
);
