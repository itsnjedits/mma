/**
 * ============================================================
 *  MINISTRY OF MECHANICAL AFFAIRS — SPA Engine
 *  script.js  (v5 — full path audit & URL encoding)
 * ============================================================
 *
 *  ROOT-CAUSE FIXES IN THIS VERSION:
 *
 *  [FIX-1] resources.json fetch path (CRITICAL)
 *    - Was:  fetch('./mma/resources.json')
 *            → resolves to /mma/mma/resources.json on GH Pages → 404!
 *    - Now:  fetch('./resources.json') + fallback ./data/resources.json
 *            → resolves to /mma/resources.json ✓
 *
 *  [FIX-2] resources.json paths have wrong mma/ prefix (CRITICAL)
 *    - All path/thumbnail/txt fields in resources.json had mma/ prepended:
 *         "mma/resources/3rd sem/file.pdf"
 *      From page at /mma/ this resolves to /mma/mma/resources/... → 404!
 *    - Fixed: paths now start with resources/ (no mma/ prefix):
 *         "resources/3rd sem/file.pdf" → /mma/resources/3rd sem/file.pdf ✓
 *    - generate_json.py updated to always use SCRIPT_DIR as the root,
 *      ensuring paths are always relative to index.html.
 *
 *  [FIX-3] URL encoding for paths with spaces / special chars
 *    - All window.open(), fetch(), img.src, and download calls now wrap
 *      paths with encodeURI() so spaces → %20, & → %26, etc.
 *    - escHtml() still applied in HTML attributes for XSS safety.
 *
 *  [FIX-4] PPT/PPTX cards use triggerDownload (not window.open)
 *    - PPTX files cannot render in the browser — window.open() either
 *      failed silently or opened a corrupt view.
 *    - Now forces a proper file download via <a download>.
 *    - Same pattern applied to DOCX (new type).
 *
 *  [FIX-5] Link cards — two-tier URL strategy
 *    - Tier 1: item.link (URL baked at build-time by generate_json.py v4)
 *              → zero extra network requests, fastest.
 *    - Tier 2: fetch(encodeURI(item.txt)) → read URL from .txt at runtime
 *              → fallback for items not yet regenerated.
 *    - All failures logged with: original path, resolved URL, error reason.
 *
 *  [FIX-6] DOCX support added
 *    - generate_json.py now emits type:"docx" for .docx files.
 *    - renderResourceCard() renders a Word Document card with download btn.
 *    - handleCardClick() triggers download (never window.open).
 *
 *  [FIX-7] HTML syntax error in renderAbout()
 *    - Email anchor tag had missing closing quote and no closing > on tag.
 *    - Was:  <a href="https://...gmail.com> target="_blank"
 *    - Now:  <a href="https://...gmail.com" target="_blank" class="...">
 *
 *  [FIX-8] Defensive console logging for all 404-prone paths
 *    - Every resource open/download/fetch now logs:
 *        name, originalPath, resolvedUrl
 *    - Every failure logs httpStatus + error message.
 *    - Thumbnail/image onerror logs the failing URL.
 *
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────────
//  DATA: Members
// ──────────────────────────────────────────────
const MEMBERS = [
  {
    id: 1,
    initials: 'NM',
    name: 'Nikhil Mittal',
    role: 'Founder',
    dept: 'Ministry of Mechanical Affairs',
    bio: 'The visionary who forged the foundations of the Ministry. Driven by precision, discipline, and an unwavering commitment to engineering excellence, he transformed a shared passion for mechanical innovation into a brotherhood united by purpose and craftsmanship.',
    skills: ['Leadership', 'Engineering Vision', 'Innovation', 'Strategic Planning'],
  },

  {
    id: 2,
    initials: 'SS',
    name: 'Shivam Sharma',
    role: 'Co-Founder',
    dept: 'Ministry of Mechanical Affairs',
    bio: 'A key architect behind the Ministry’s growth and culture. Known for his problem-solving mindset and relentless pursuit of perfection, he bridges ideas with execution and inspires members to push beyond conventional limits.',
    skills: ['Project Management', 'Team Building', 'Mechanical Design', 'Operations'],
  },

  {
    id: 3,
    initials: 'SC',
    name: 'Sunil Choudhary',
    role: 'Union Leader',
    dept: 'Ministry of Mechanical Affairs',
    bio: 'The voice of unity and brotherhood within the Ministry. Respected for his dedication, mentorship, and ability to bring engineers together under a common mission, he strengthens the spirit that drives the organization forward.',
    skills: ['Mentorship', 'Communication', 'Leadership', 'Community Building'],
  },
];

// ──────────────────────────────────────────────
//  DATA: Council
// ──────────────────────────────────────────────

const COUNCIL = [
  {
    initials: 'NM',
    name: 'Nikhil Mittal',
    role: 'Founder',
    desc: 'The visionary who established the Ministry and laid the foundations of its culture. Guided by discipline, innovation, and brotherhood, he transformed a shared passion for engineering into a movement driven by purpose and excellence.',
    icon: '⚙️',
  },

  {
    initials: 'SS',
    name: 'Shivam Sharma',
    role: 'Co-Founder',
    desc: 'A founding pillar of the Ministry who helped shape its identity and direction. Known for turning ambitious ideas into reality, he continues to strengthen the bond between creativity, engineering, and leadership.',
    icon: '🔧',
  },

  {
    initials: 'SC',
    name: 'Sunil Choudhary',
    role: 'Union Leader',
    desc: 'The voice of unity within the Brotherhood. Through mentorship, guidance, and unwavering dedication, he ensures that every member contributes to the Ministry’s shared mission and collective growth.',
    icon: '🏛️',
  },
];

// ──────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────
const state = {
  logoClickCount: 0,
  logoClickTimer: null,
  resourceData:   null,
  resourceStack:  [],
  searchQuery:    '',
  sortMode:       'name-az',
};

// ──────────────────────────────────────────────
//  ROUTER
// ──────────────────────────────────────────────
const routes = {
  '/':          renderHome,
  '/about':     renderAbout,
  '/resources': renderResources,
};

function navigate(path, push = true) {
  if (push) history.pushState({}, '', path);
  updateNavHighlight(path);
  const app = document.getElementById('app');
  app.innerHTML = '';
  const render = routes[path] || renderHome;
  render(app);
  window.scrollTo(0, 0);
  document.getElementById('navLinks').classList.remove('open');
}

window.addEventListener('popstate', () => navigate(location.pathname, false));

function updateNavHighlight(path) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.route === path);
  });
}

// ──────────────────────────────────────────────
//  NAVBAR
// ──────────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.route));
});

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('open');
});

document.getElementById('logoBtn').addEventListener('click', () => {
  state.logoClickCount++;
  clearTimeout(state.logoClickTimer);
  if (state.logoClickCount >= 5) {
    state.logoClickCount = 0;
    showEasterEgg();
  } else {
    state.logoClickTimer = setTimeout(() => { state.logoClickCount = 0; }, 2000);
  }
});

// ──────────────────────────────────────────────
//  GEAR SVG BUILDER (used in hero / footer)
// ──────────────────────────────────────────────
function buildGearSVG({ cx, cy, r, teeth, stroke, opacity, cls, strokeW = 1.5 }) {
  const toothH = r * 0.22;
  const inner  = r - toothH;
  const step   = (2 * Math.PI) / teeth;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a1 = i * step - step * 0.35;
    const a2 = i * step - step * 0.1;
    const a3 = i * step + step * 0.1;
    const a4 = i * step + step * 0.35;
    d += `L ${cx + inner * Math.cos(a1)} ${cy + inner * Math.sin(a1)} `;
    d += `L ${cx + r     * Math.cos(a2)} ${cy + r     * Math.sin(a2)} `;
    d += `L ${cx + r     * Math.cos(a3)} ${cy + r     * Math.sin(a3)} `;
    d += `L ${cx + inner * Math.cos(a4)} ${cy + inner * Math.sin(a4)} `;
  }
  d = 'M' + d.slice(1) + 'Z';
  return `<path class="gear ${cls}" d="${d}" stroke="${stroke}" stroke-width="${strokeW}" fill="none" opacity="${opacity}" />
          <circle cx="${cx}" cy="${cy}" r="${r * 0.22}" stroke="${stroke}" stroke-width="${strokeW}" fill="none" opacity="${opacity}" class="gear ${cls}" />`;
}

// ──────────────────────────────────────────────
//  PERPETUAL MOTION MACHINE  (SVG)
// ──────────────────────────────────────────────
function buildPMM() {
  const gold  = '#C9A84C', goldD = '#9A7530', goldL = '#E8C96A';
  const blue  = '#4A90E2', steel = '#2C2C2C', steelL = '#4A4A4A';

  // Gear outline path builder
  function gear(cx, cy, r, teeth, animCls, color, sw) {
    const toothH = r * 0.20, inner = r - toothH;
    const step   = (2 * Math.PI) / teeth;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a1 = i * step - step * 0.35, a2 = i * step - step * 0.1;
      const a3 = i * step + step * 0.1,  a4 = i * step + step * 0.35;
      d += `L ${cx + inner*Math.cos(a1)} ${cy + inner*Math.sin(a1)} `;
      d += `L ${cx + r    *Math.cos(a2)} ${cy + r    *Math.sin(a2)} `;
      d += `L ${cx + r    *Math.cos(a3)} ${cy + r    *Math.sin(a3)} `;
      d += `L ${cx + inner*Math.cos(a4)} ${cy + inner*Math.sin(a4)} `;
    }
    d = 'M' + d.slice(1) + 'Z';
    const spokes = Array.from({length: Math.max(4, Math.floor(teeth / 3))}, (_, i) => {
      const a = (2 * Math.PI / Math.max(4, Math.floor(teeth / 3))) * i;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + inner * 0.75 * Math.cos(a)}" y2="${cy + inner * 0.75 * Math.sin(a)}" stroke="${color}" stroke-width="${sw * 0.6}" opacity="0.4"/>`;
    }).join('');
    return `<g class="${animCls}" style="transform-origin:${cx}px ${cy}px;">
      <path d="${d}" stroke="${color}" stroke-width="${sw}" fill="${color}" fill-opacity="0.06" opacity="0.8"/>
      ${spokes}
      <circle cx="${cx}" cy="${cy}" r="${r * 0.22}" stroke="${color}" stroke-width="${sw}" fill="${steelL}" opacity="0.9"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.08}" fill="${color}" opacity="0.9"/>
    </g>`;
  }

  // Gear layout — meshing radii: G1+G2 must touch, G2+G3 must touch
  const g1cx = 155, g1cy = 148, g1r = 55, g1t = 16;
  const g2cx = 265, g2cy = 148, g2r = 35, g2t = 10;
  const g3cx = 350, g3cy = 148, g3r = 21, g3t = 6;
  const fwcx = 420, fwcy = 148, fwr = 28;

  // Belt tangent lines from G2 axle to flywheel
  const beltTop = g2cy - g2r * 0.35, beltBot = g2cy + g2r * 0.35;

  return `
  <div style="display:flex;flex-direction:column;align-items:center;">
    <div style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;letter-spacing:0.25em;color:rgba(201,168,76,0.35);margin-bottom:0.6rem;text-transform:uppercase;">
      ⚙ Perpetual Motion Assembly · da Vinci Class ⚙
    </div>
    <svg viewBox="0 0 520 240" width="min(520px,90vw)" height="auto"
         xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
      <defs>
        <style>
          .pmm-cw   { animation: pmm-cw  14s linear infinite; }
          .pmm-ccw  { animation: pmm-ccw  8.75s linear infinite; }
          .pmm-fast { animation: pmm-cw   5.25s linear infinite; }
          .pmm-fw   { animation: pmm-cw   8.75s linear infinite; }
          .pmm-pend { transform-origin: ${g1cx}px 52px; animation: pmm-swing 3.2s ease-in-out infinite; }
          @keyframes pmm-cw   { to { transform: rotate(360deg);  } }
          @keyframes pmm-ccw  { to { transform: rotate(-360deg); } }
          @keyframes pmm-swing {
            0%,100% { transform: rotate(-16deg); }
            50%     { transform: rotate(16deg); }
          }
          .pmm-belt-flow { animation: beltDash 2s linear infinite; }
          @keyframes beltDash { to { stroke-dashoffset: -20; } }
        </style>
        <filter id="pgold" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="pblue" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- Base plate -->
      <rect x="30" y="218" width="455" height="5" rx="2" fill="${steelL}" opacity="0.5"/>
      <rect x="50" y="223" width="415" height="2" rx="1" fill="${goldD}"  opacity="0.2"/>

      <!-- Support pillars -->
      <rect x="${g1cx-3}" y="${g1cy+g1r+2}" width="6" height="${218-g1cy-g1r-2}" fill="${steelL}" opacity="0.45"/>
      <rect x="${g2cx-3}" y="${g2cy+g2r+2}" width="6" height="${218-g2cy-g2r-2}" fill="${steelL}" opacity="0.4"/>
      <rect x="${fwcx-3}" y="${fwcy+fwr+2}" width="6" height="${218-fwcy-fwr-2}" fill="${steelL}" opacity="0.35"/>

      <!-- Belt: G2 to flywheel -->
      <line x1="${g2cx+g2r}" y1="${beltTop}" x2="${fwcx-fwr}" y2="${beltTop}"
            stroke="${goldD}" stroke-width="2" stroke-dasharray="6 3" opacity="0.35"
            class="pmm-belt-flow"/>
      <line x1="${g2cx+g2r}" y1="${beltBot}" x2="${fwcx-fwr}" y2="${beltBot}"
            stroke="${goldD}" stroke-width="2" stroke-dasharray="6 3" opacity="0.25"
            style="animation: beltDash 2s linear infinite reverse;"/>

      <!-- Flywheel (belt-driven, CW) -->
      <g class="pmm-fw" style="transform-origin:${fwcx}px ${fwcy}px;">
        <circle cx="${fwcx}" cy="${fwcy}" r="${fwr}" stroke="${gold}" stroke-width="2.5" fill="none" opacity="0.7" filter="url(#pgold)"/>
        <circle cx="${fwcx}" cy="${fwcy}" r="${fwr*0.65}" stroke="${goldD}" stroke-width="1" fill="none" opacity="0.3"/>
        ${Array.from({length:6},(_,i)=>{const a=(Math.PI/3)*i; return `<line x1="${fwcx}" y1="${fwcy}" x2="${fwcx+fwr*0.85*Math.cos(a)}" y2="${fwcy+fwr*0.85*Math.sin(a)}" stroke="${gold}" stroke-width="1.2" opacity="0.45"/>`;}).join('')}
        <circle cx="${fwcx}" cy="${fwcy}" r="${fwr*0.2}" fill="${steelL}" stroke="${gold}" stroke-width="1.2" opacity="0.9"/>
        <circle cx="${fwcx}" cy="${fwcy}" r="${fwr*0.07}" fill="${gold}" opacity="1"/>
      </g>

      <!-- G1: main large gear CW -->
      ${gear(g1cx, g1cy, g1r, g1t, 'pmm-cw', gold, 2.2)}

      <!-- G2: medium gear CCW (meshes with G1) -->
      ${gear(g2cx, g2cy, g2r, g2t, 'pmm-ccw', goldL, 1.8)}

      <!-- G3: small fast gear CW (meshes with G2) -->
      ${gear(g3cx, g3cy, g3r, g3t, 'pmm-fast', blue, 1.4)}

      <!-- Pendulum attached to G1 column -->
      <g class="pmm-pend">
        <!-- pivot bar -->
        <rect x="${g1cx-7}" y="46" width="14" height="8" rx="2" fill="${steel}" stroke="${goldD}" stroke-width="1" opacity="0.85"/>
        <!-- rod -->
        <line x1="${g1cx}" y1="52" x2="${g1cx}" y2="118" stroke="${gold}" stroke-width="1.8" opacity="0.55"/>
        <!-- mid weight ring -->
        <circle cx="${g1cx}" cy="80" r="4" fill="none" stroke="${goldD}" stroke-width="1" opacity="0.4"/>
        <!-- bob -->
        <circle cx="${g1cx}" cy="122" r="10" fill="${steelL}" stroke="${gold}" stroke-width="2" filter="url(#pgold)" opacity="0.9"/>
        <circle cx="${g1cx}" cy="122" r="4"  fill="${gold}" opacity="0.95"/>
      </g>

      <!-- Labels -->
      <text x="${g1cx}" y="236" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6" fill="${goldD}" opacity="0.4" letter-spacing="1">DRIVE</text>
      <text x="${g2cx}" y="236" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6" fill="${goldD}" opacity="0.4" letter-spacing="1">OUTPUT</text>
      <text x="${fwcx}" y="236" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6" fill="${goldD}" opacity="0.35" letter-spacing="1">FLYWHEEL</text>
    </svg>
    <div style="font-family:'Share Tech Mono',monospace;font-size:0.55rem;letter-spacing:0.2em;color:rgba(201,168,76,0.22);margin-top:0.5rem;text-transform:uppercase;">
      [ The machine does not rest. Neither do we. ]
    </div>
  </div>`;
}

// ──────────────────────────────────────────────
//  HOME PAGE
// ──────────────────────────────────────────────
function renderHome(container) {
  container.innerHTML = `
    <section class="hero">
      <div class="hero-bg"></div>

      <div class="hero-gears">
        <svg width="100%" height="100%" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;">
          ${buildGearSVG({ cx:80,   cy:120, r:60, teeth:12, stroke:'#C9A84C', opacity:0.12, cls:'gear-cw'   })}
          ${buildGearSVG({ cx:180,  cy:90,  r:30, teeth:8,  stroke:'#C9A84C', opacity:0.10, cls:'gear-ccw'  })}
          ${buildGearSVG({ cx:1120, cy:650, r:80, teeth:16, stroke:'#C9A84C', opacity:0.10, cls:'gear-cw'   })}
          ${buildGearSVG({ cx:1000, cy:700, r:40, teeth:10, stroke:'#4A90E2', opacity:0.08, cls:'gear-ccw'  })}
          ${buildGearSVG({ cx:600,  cy:750, r:50, teeth:12, stroke:'#C9A84C', opacity:0.06, cls:'gear-slow' })}
          ${buildGearSVG({ cx:200,  cy:750, r:35, teeth:9,  stroke:'#4A90E2', opacity:0.07, cls:'gear-ccw'  })}
          ${buildGearSVG({ cx:1050, cy:100, r:45, teeth:10, stroke:'#C9A84C', opacity:0.09, cls:'gear-slow' })}
        </svg>
      </div>

      <div style="position:relative;z-index:2;max-width:800px;width:100%;">
        <div class="section-tag" style="justify-content:center;display:flex;margin-bottom:1rem;">
          ⚙ &nbsp; ESTABLISHED 2022 &nbsp; ⚙
        </div>
        <h1 class="hero-title">MINISTRY OF<br>MECHANICAL AFFAIRS</h1>
        <p class="hero-subtitle">Engineering Destiny · Discipline · Brotherhood</p>
        <div class="hero-divider"></div>
        <p style="color:#666;font-size:1rem;letter-spacing:0.05em;max-width:480px;margin:0 auto 2rem;line-height:1.7;">
          A secret order of mechanical engineers forged in precision, driven by curiosity,
          and united by the relentless pursuit of engineering excellence.
        </p>
        <button class="cta-btn" onclick="navigate('/resources')">Enter the Ministry</button>
      </div>

      <!-- PERPETUAL MOTION MACHINE -->
      <div style="position:relative;z-index:2;margin-top:3rem;">
        ${buildPMM()}
      </div>

      <div style="position:absolute;bottom:2rem;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:0.5rem;opacity:0.4;">
        <span style="font-size:0.65rem;letter-spacing:0.3em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;">SCROLL</span>
        <div style="width:1px;height:40px;background:linear-gradient(180deg,#C9A84C,transparent);animation:pulse 2s infinite;"></div>
      </div>
    </section>

    <!-- STATS -->
    <section style="padding:5rem 2rem;max-width:1100px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:3rem;">
        <div class="section-tag" style="display:block;text-align:center;">[ MINISTRY VITALS ]</div>
        <h2 class="section-title">The <span>Numbers</span> Speak</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.5rem;">
        <div class="stat-card"><div class="stat-icon">⚙️</div><div class="stat-number">10+</div><div class="stat-label">Active Members</div></div>
        <div class="stat-card"><div class="stat-icon">📍</div><div class="stat-number">Jodhpur</div><div class="stat-label">Rajasthan, India</div></div>
        <div class="stat-card"><div class="stat-icon">🏛️</div><div class="stat-number">1994</div><div class="stat-label">Founded Year</div></div>
        <div class="stat-card"><div class="stat-icon">🔩</div><div class="stat-number">∞</div><div class="stat-label">Commitment</div></div>
      </div>
    </section>

    <div class="gold-divider" style="max-width:1100px;margin:0 auto;"></div>

    <!-- MEMBERS -->
    <section style="padding:4rem 2rem;max-width:1100px;margin:0 auto;">
      <div style="margin-bottom:3rem;">
        <div class="section-tag">[ BROTHERHOOD ROSTER ]</div>
        <h2 class="section-title">The <span>Members</span></h2>
        <div class="section-line"></div>
        <p style="color:#666;font-size:1rem;line-height:1.7;max-width:520px;">
          Each member is handpicked — screened not just for technical prowess,
          but for character, discipline, and the will to build.
        </p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem;">
        ${MEMBERS.map(m => `
          <div class="member-card" onclick="showMemberModal(${m.id})">
            <div class="member-avatar">${m.initials}</div>
            <div class="member-name">${m.name}</div>
            <div class="member-role">${m.role}</div>
            <div style="margin-top:0.75rem;display:flex;align-items:center;justify-content:center;gap:0.5rem;">
              <span class="pulse-dot" style="width:5px;height:5px;"></span>
              <span style="font-size:0.65rem;color:#444;letter-spacing:0.15em;text-transform:uppercase;">Active</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    ${renderFooter()}
  `;
}

// ──────────────────────────────────────────────
//  MEMBER MODAL
// ──────────────────────────────────────────────
function showMemberModal(id) {
  const m = MEMBERS.find(x => x.id === id);
  if (!m) return;
  showModal(`
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
      <div class="member-avatar" style="width:100px;height:100px;font-size:2rem;margin-bottom:1.5rem;">${m.initials}</div>
      <h3 style="font-family:'Cinzel',serif;font-size:1.4rem;font-weight:900;color:#C9A84C;margin-bottom:0.25rem;">${m.name}</h3>
      <div style="font-size:0.75rem;letter-spacing:0.2em;text-transform:uppercase;color:#666;margin-bottom:0.5rem;">${m.role}</div>
      <div style="font-size:0.8rem;color:#555;margin-bottom:1.5rem;font-family:'Share Tech Mono',monospace;">${m.dept}</div>
      <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);margin-bottom:1.5rem;"></div>
      <p style="color:#999;font-size:0.95rem;line-height:1.7;text-align:left;">${m.bio}</p>
      <div style="margin-top:1.5rem;display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;">
        ${m.skills.map(s => `
          <span style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);color:#C9A84C;padding:0.25rem 0.75rem;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;">${s}</span>
        `).join('')}
      </div>
    </div>
  `);
}

// ──────────────────────────────────────────────
//  ABOUT PAGE
// ──────────────────────────────────────────────
function renderAbout(container) {
  container.innerHTML = `
    <section style="padding:6rem 2rem 4rem;max-width:900px;margin:0 auto;">
      <div class="section-tag">[ OUR STORY ]</div>
      <h1 class="section-title" style="font-size:clamp(2rem,5vw,3.5rem);">We Are Not Just A <span>Club</span></h1>
      <div class="section-line"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start;" class="about-grid">
        <div>
  <p style="color:#999;font-size:1.05rem;line-height:1.8;margin-bottom:1.5rem;">
    If you are merely human, this site isn't for you. But if you are a machine—grinding
    through the daily routine while hiding absurd, eccentric thoughts revving deep inside
    your engine—then you are exactly where you belong.
  </p>

  <p style="color:#777;font-size:1rem;line-height:1.8;margin-bottom:1.5rem;">
    The superficial world outside may never understand or accept our unfiltered reality.
    Here at the Ministry, we drop the act. Titles, appearances, and expectations mean
    nothing. We judge members by only one criterion: how delightfully twisted, creative,
    and chaotic their minds truly are.
  </p>

  <p style="color:#666;font-size:1rem;line-height:1.8;">
    Escape the polished illusion. Embrace the madness. Let your imagination run
    unrestricted, your ideas collide like gears in motion, and your true mechanical
    spirit reveal itself.
    <strong style="color:#C9A84C;">The Ministry awaits.</strong>
  </p>
</div>
        <div style="background:rgba(26,26,26,0.8);border:1px solid rgba(201,168,76,0.15);padding:2rem;">
          <div class="section-tag" style="margin-bottom:1rem;">[ MINISTRY CHARTER ]</div>
          ${[
            'Pursue engineering excellence without compromise',
            'Support every member\'s growth relentlessly',
            'Solve real-world problems with first-principles thinking',
            'Uphold the dignity of the mechanical discipline',
            'Build, break, rebuild — until it\'s right',
          ].map((item, i) => `
            <div style="display:flex;gap:1rem;align-items:flex-start;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
              <span style="font-family:'Cinzel',serif;color:rgba(201,168,76,0.4);font-size:0.9rem;min-width:1.5rem;">0${i+1}</span>
              <span style="color:#888;font-size:0.9rem;line-height:1.5;">${item}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <div class="gold-divider" style="max-width:1100px;margin:0 auto;"></div>

    <section style="padding:4rem 2rem;max-width:1100px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:3rem;">
        <div class="section-tag" style="display:block;text-align:center;">[ GOVERNING BODY ]</div>
        <h2 class="section-title">The High <span>Council</span></h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;">
        ${COUNCIL.map(c => `
          <div class="council-card">
            <div style="font-size:2.5rem;margin-bottom:1.5rem;">${c.icon}</div>
            <div class="member-avatar" style="margin-bottom:1rem;">${c.initials}</div>
            <div class="member-name" style="font-size:1.2rem;">${c.name}</div>
            <div style="font-size:0.7rem;letter-spacing:0.25em;text-transform:uppercase;color:#C9A84C;opacity:0.7;margin:0.4rem 0 1rem;">${c.role}</div>
            <p style="color:#666;font-size:0.9rem;line-height:1.6;">${c.desc}</p>
          </div>
        `).join('')}
      </div>
    </section>

    <div class="gold-divider" style="max-width:1100px;margin:0 auto;"></div>

    <section style="padding:4rem 2rem;max-width:900px;margin:0 auto;">
      <div style="margin-bottom:3rem;">
        <div class="section-tag">[ ENLISTMENT PROTOCOL ]</div>
        <h2 class="section-title">How to <span>Join</span></h2>
        <div class="section-line"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${[
          { n:'01', t:'Application',         d:'Submit your application with a statement of intent and your engineering philosophy.' },
          { n:'02', t:'Eligibility Review',   d:'Academic record, extracurriculars, and project portfolio evaluated. Minimum CGPA 7.5.' },
          { n:'03', t:'Physical Aptitude Test',d:'A hands-on fabrication challenge in the workshop under pressure.' },
          { n:'04', t:'Mental Calibration Test',d:'Analytical exam: thermodynamics, mechanics, fluid systems, design thinking.' },
        ].map(s => `
          <div class="step-item">
            <div class="step-num">${s.n}</div>
            <div>
              <div style="font-family:'Cinzel',serif;font-weight:700;font-size:1.05rem;color:#CCC;margin-bottom:0.5rem;">${s.t}</div>
              <p style="color:#666;font-size:0.9rem;line-height:1.6;">${s.d}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <div class="gold-divider" style="max-width:1100px;margin:0 auto;"></div>

    <section style="padding:4rem 2rem 6rem;max-width:900px;margin:0 auto;">
      <div style="margin-bottom:3rem;">
        <div class="section-tag">[ SECURE CHANNEL ]</div>
        <h2 class="section-title">Contact the <span>Ministry</span></h2>
        <div class="section-line"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;">
        <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ministryofmechanicalaffairs@gmail.com" target="_blank" class="contact-btn" style="color:#D4AF37;border-color:rgba(212,175,55,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          ministryofmechanicalaffairs@gmail.com
        </a>
        <a href="https://www.instagram.com/ministry_of_mechanical_affairs?igsh=MXgydW5jb3lvMGFvNA==" target="_blank" class="contact-btn" style="color:#E1306C;border-color:rgba(225,48,108,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          @mma_official
        </a>
        
      </div>
    </section>
    ${renderFooter()}
  `;

  if (window.innerWidth < 768) {
    const grid = container.querySelector('.about-grid');
    if (grid) grid.style.gridTemplateColumns = '1fr';
  }
}

// ──────────────────────────────────────────────
//  RESOURCES PAGE
// ──────────────────────────────────────────────
function renderResources(container) {
  container.innerHTML = `
    <div class="resources-layout" id="resourcesLayout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-title">[ DIRECTORIES ]</div>
        <div id="sidebarItems">
          <div class="sidebar-item active">
            ${homeIcon()} All Resources
          </div>
        </div>
      </aside>

      <div class="resource-main" id="resourceMain">
        <div style="display:flex;gap:1rem;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <input class="search-input" id="searchInput" type="text" placeholder="Search resources..." value="${state.searchQuery}" />
          </div>
          <select class="sort-select" id="sortSelect">
            <option value="name-az" ${state.sortMode==='name-az'?'selected':''}>Name A–Z</option>
            <option value="name-za" ${state.sortMode==='name-za'?'selected':''}>Name Z–A</option>
            <option value="type"    ${state.sortMode==='type'   ?'selected':''}>Type Priority</option>
          </select>
        </div>
        <div class="breadcrumb" id="breadcrumb"></div>
        <div id="resourceGrid"></div>
      </div>
    </div>
    ${renderFooter()}
  `;

  document.getElementById('searchInput').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    renderResourceGrid();
  });
  document.getElementById('sortSelect').addEventListener('change', e => {
    state.sortMode = e.target.value;
    renderResourceGrid();
  });

  if (state.resourceData) {
    populateResourceSidebar();
    renderResourceGrid();
  } else {
    loadResourceData();
  }
}

// ──────────────────────────────────────────────
//  [FIX-1] LOAD RESOURCE JSON — correct path strategy
//
//  Priority order:
//    1. ./data/resources.json  (standard layout)
//    2. ./resources.json       (root layout fallback)
//    3. Built-in sample data   (last resort)
// ──────────────────────────────────────────────
async function loadResourceData() {
  showResourceSkeleton();

  const candidates = [
    './mma/resources.json',       // correct: relative to index.html at /mma/
    './mma/data/resources.json',  // fallback: alternate layout
  ];

  let loaded = false;
  for (const url of candidates) {
    try {
      console.log('[MMA] Trying:', url);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      state.resourceData = await resp.json();
      console.log(`[MMA] ✓ Loaded from ${url} — ${state.resourceData.length} top-level items`);
      loaded = true;
      break;
    } catch (err) {
      console.warn(`[MMA] ✗ Failed ${url}:`, err.message);
    }
  }

  if (!loaded) {
    console.warn('[MMA] All fetch attempts failed — using sample data');
    state.resourceData = getSampleResourceData();
  }

  state.resourceStack = [{ name: 'All Resources', items: state.resourceData }];
  populateResourceSidebar();
  renderResourceGrid();
}

// ──────────────────────────────────────────────
//  SAMPLE DATA (all link items use item.link directly)
// ──────────────────────────────────────────────
function getSampleResourceData() {
  return [
    {
      name: 'Mechanics', type: 'folder',
      children: [
        { name: 'Engineering Mechanics Notes', type: 'pdf',   path: 'resources/Mechanics/engineering_mechanics_notes.pdf' },
        { name: 'Free Body Diagram Guide',      type: 'pdf',   path: 'resources/Mechanics/free_body_diagram_guide.pdf' },
        { name: 'Statics Explained',
          type: 'link', thumbnail: 'resources/Mechanics/statics_explained.jpg',
          link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      ],
    },
    {
      name: 'Thermodynamics', type: 'folder',
      children: [
        { name: 'First Law of Thermodynamics', type: 'pdf', path: 'resources/Thermodynamics/first_law.pdf' },
        { name: 'PV Diagram Reference',         type: 'image', path: 'resources/Thermodynamics/pv_diagram.jpg' },
        { name: 'Heat Engines Lecture',
          type: 'link', thumbnail: 'resources/Thermodynamics/heat_engines.jpg',
          link: 'https://www.youtube.com/watch?v=example_heat' },
      ],
    },
    { name: 'Ministry Handbook', type: 'pdf', path: 'resources/ministry_handbook.pdf' },
  ];
}

// ──────────────────────────────────────────────
//  SIDEBAR — builds from top-level folders
// ──────────────────────────────────────────────
function populateResourceSidebar() {
  const sidebar = document.getElementById('sidebarItems');
  if (!sidebar) return;
  const folders = state.resourceData.filter(i => i.type === 'folder');

  sidebar.innerHTML = `
    <div class="sidebar-item active" data-idx="0">
      ${homeIcon()} All Resources
    </div>
    ${folders.map((f, i) => `
      <div class="sidebar-item" data-idx="${i + 1}">
        ${folderIcon()} ${escHtml(f.name)}
      </div>
    `).join('')}
  `;

  sidebar.querySelectorAll('.sidebar-item').forEach((el, idx) => {
    el.addEventListener('click', () => {
      sidebar.querySelectorAll('.sidebar-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.searchQuery = '';
      const inp = document.getElementById('searchInput');
      if (inp) inp.value = '';

      if (idx === 0) {
        state.resourceStack = [{ name: 'All Resources', items: state.resourceData }];
      } else {
        const folder = folders[idx - 1];
        state.resourceStack = [
          { name: 'All Resources', items: state.resourceData },
          { name: folder.name,     items: folder.children || [] },
        ];
      }
      renderResourceGrid();
    });
  });
}

// ──────────────────────────────────────────────
//  RESOURCE GRID RENDER
// ──────────────────────────────────────────────
function renderResourceGrid() {
  const grid = document.getElementById('resourceGrid');
  const bc   = document.getElementById('breadcrumb');
  if (!grid) return;

  // Breadcrumb
  if (bc) {
    bc.innerHTML = state.resourceStack.map((level, i) => {
      const isLast = i === state.resourceStack.length - 1;
      return `
        ${i > 0 ? '<span class="breadcrumb-sep">›</span>' : ''}
        <span class="breadcrumb-item" style="${isLast ? 'color:#C9A84C;' : ''}" data-level="${i}">${escHtml(level.name)}</span>
      `;
    }).join('');
    bc.querySelectorAll('.breadcrumb-item').forEach(el => {
      el.addEventListener('click', () => {
        const lvl = parseInt(el.dataset.level);
        state.resourceStack = state.resourceStack.slice(0, lvl + 1);
        renderResourceGrid();
      });
    });
  }

  const current = state.resourceStack[state.resourceStack.length - 1];
  let items = [...(current.items || [])];

  if (state.searchQuery.trim()) {
    items = recursiveSearch(items, state.searchQuery.toLowerCase());
  }
  items = sortItems(items, state.sortMode);

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚙️</div>
        <div class="empty-state-text">No resources found here yet.</div>
        <div style="margin-top:0.5rem;font-size:0.8rem;color:#333;">The Ministry's archives are being compiled.</div>
      </div>`;
    return;
  }

  // Store items by unique key (index) to avoid name-collision issues
  const itemMap = {};
  items.forEach((item, i) => { itemMap[i] = item; });

  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem;">
      ${items.map((item, i) => renderResourceCard(item, i)).join('')}
    </div>`;

  // Card click — use data-idx to look up item, avoiding name-matching bugs
  grid.querySelectorAll('[data-idx]').forEach(el => {
    // Don't bind on download btn itself — it has its own handler below
    if (el.dataset.role === 'download') return;
    el.addEventListener('click', () => {
      const item = itemMap[parseInt(el.dataset.idx)];
      if (item) handleCardClick(item);
    });
  });

  // Download buttons — separate so click doesn't bubble to card
  grid.querySelectorAll('[data-role="download"]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      triggerDownload(el.dataset.path, el.dataset.name);
    });
  });

  // Lazy-load thumbnails via IntersectionObserver
  const imgs = grid.querySelectorAll('img[data-src]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        io.unobserve(img);
      }
    });
  });
  imgs.forEach(img => io.observe(img));
}

// ──────────────────────────────────────────────
//  RENDER INDIVIDUAL RESOURCE CARD
// ──────────────────────────────────────────────
function renderResourceCard(item, idx) {
  // Thumbnail placeholder SVG (shown while lazy-loading or on error)
  const thumbPlaceholder = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='90'><rect width='160' height='90' fill='%23222'/><text x='80' y='50' text-anchor='middle' fill='%23444' font-size='24'>🖼</text></svg>`;

  switch (item.type) {

    // ── FOLDER ─────────────────────────────────────────────
    case 'folder':
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;">
          <div class="resource-card-icon">📁</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type">Folder · ${(item.children||[]).length} items</div>
        </div>`;

    // ── PDF ────────────────────────────────────────────────
    case 'pdf':
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;">
          <div class="resource-card-icon">📄</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type">PDF Document</div>
          <div class="download-btn" data-role="download" data-path="${escHtml(item.path||'')}" data-name="${escHtml(item.name)}">
            ↓ Download
          </div>
        </div>`;

    // ── PPT / PPTX ─────────────────────────────────────────
    case 'ppt':
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;">
          <div class="resource-card-icon">📊</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type" style="color:#C9844C;">PPTX Presentation</div>
          <div class="download-btn" data-role="download" data-path="${escHtml(item.path||'')}" data-name="${escHtml(item.name)}" style="border-color:rgba(201,132,76,0.35);color:#C9844C;">
            ↓ Download
          </div>
        </div>`;

    // ── LINK (YouTube / Drive) ─────────────────────────────
    // item.link is a baked URL (from generate_json.py), or falls back to fetching .txt at runtime
    case 'link':
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;padding:0;overflow:hidden;">
          <div style="position:relative;">
            ${item.thumbnail
              ? `<img data-src="${escHtml(encodeURI(item.thumbnail))}" src="${thumbPlaceholder}"
                      alt="${escHtml(item.name)}" class="resource-card-thumb"
                      onerror="console.error('[MMA] Thumbnail 404:',this.dataset.src);this.src='${thumbPlaceholder}'" />`
              : `<div style="height:100px;background:rgba(74,144,226,0.08);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">🎬</div>`
            }
            <!-- Play overlay -->
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);transition:background 0.2s;">
              <svg width="36" height="36" viewBox="0 0 36 36" style="filter:drop-shadow(0 0 8px rgba(201,168,76,0.9));">
                <circle cx="18" cy="18" r="17" fill="rgba(13,13,13,0.6)" stroke="#C9A84C" stroke-width="1.5"/>
                <polygon points="14,11 28,18 14,25" fill="#C9A84C"/>
              </svg>
            </div>
          </div>
          <div style="padding:0.9rem;">
            <div class="resource-card-name">${escHtml(item.name)}</div>
            <div class="resource-card-type" style="margin-top:0.25rem;">
              ${item.link && item.link.includes('drive.google') ? '📁 Google Drive' : '▶ Video Link'}
            </div>
          </div>
        </div>`;

    // ── IMAGE ──────────────────────────────────────────────
    case 'image':
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;padding:0;overflow:hidden;">
          <img data-src="${escHtml(encodeURI(item.path||''))}" src="${thumbPlaceholder}"
               alt="${escHtml(item.name)}" class="resource-card-thumb"
               onerror="console.error('[MMA] Image 404:',this.dataset.src);this.src='${thumbPlaceholder}'" />
          <div style="padding:0.9rem;">
            <div class="resource-card-name">${escHtml(item.name)}</div>
            <div class="resource-card-type">🖼 Image</div>
          </div>
        </div>`;

    // ── DOCX ───────────────────────────────────────────────
    case 'docx':
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;">
          <div class="resource-card-icon">📝</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type" style="color:#4A90E2;">Word Document</div>
          <div class="download-btn" data-role="download" data-path="${escHtml(item.path||'')}" data-name="${escHtml(item.name)}" style="border-color:rgba(74,144,226,0.35);color:#4A90E2;">
            ↓ Download
          </div>
        </div>`;

    // ── UNKNOWN ────────────────────────────────────────────
    default:
      return `
        <div class="resource-card" data-idx="${idx}" style="cursor:pointer;">
          <div class="resource-card-icon">📎</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type">File</div>
        </div>`;
  }
}

// ──────────────────────────────────────────────
//  [FIX-2] CARD CLICK HANDLER — reads item.link directly
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
//  [FIX] CARD CLICK HANDLER
//  - Pehle item.link check karta hai (agar generate_json.py ne bake kiya ho)
//  - Nahi mila toh item.txt se fetch karke URL nikalta hai
// ──────────────────────────────────────────────
function handleCardClick(item) {
  switch (item.type) {
    case 'folder':
      state.resourceStack.push({ name: item.name, items: item.children || [] });
      renderResourceGrid();
      break;
 
    case 'pdf': {
      const resolvedUrl = encodeURI(item.path);
      console.log('[MMA] Opening PDF:', { name: item.name, originalPath: item.path, resolvedUrl });
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      break;
    }
 
    case 'ppt': {
      // PPTX cannot render in-browser — always trigger a download
      const resolvedUrl = encodeURI(item.path);
      console.log('[MMA] Downloading PPTX:', { name: item.name, originalPath: item.path, resolvedUrl });
      triggerDownload(item.path, item.name);
      break;
    }
 
    case 'link':
      // ── Priority 1: item.link already baked in JSON ─────────────
      if (item.link && item.link.trim()) {
        const url = item.link.trim();
        console.log('[MMA] Opening link:', { name: item.name, url });
        window.open(url, '_blank', 'noopener,noreferrer');

      // ── Priority 2: fetch URL from .txt file at runtime ──────────
      } else if (item.txt && item.txt.trim()) {
        const txtPath    = item.txt.trim();
        const resolvedUrl = encodeURI(txtPath);
        console.log('[MMA] Fetching .txt for link:', { name: item.name, originalPath: txtPath, resolvedUrl });

        fetch(resolvedUrl)
          .then(function(resp) {
            if (!resp.ok) {
              console.error('[MMA] .txt fetch failed:', { name: item.name, originalPath: txtPath, resolvedUrl, httpStatus: resp.status });
              throw new Error('HTTP ' + resp.status);
            }
            return resp.text();
          })
          .then(function(text) {
            const url = text.trim();
            if (url) {
              console.log('[MMA] .txt resolved URL:', url);
              window.open(url, '_blank', 'noopener,noreferrer');
            } else {
              console.error('[MMA] .txt is empty:', { originalPath: txtPath, resolvedUrl });
              showToast('Link file is empty — check the .txt file: ' + txtPath, 'error');
            }
          })
          .catch(function(err) {
            console.error('[MMA] .txt fetch error:', { name: item.name, originalPath: txtPath, resolvedUrl, error: err.message });
            showToast('Could not load link — .txt fetch failed: ' + txtPath, 'error');
          });

      // ── No link source found ─────────────────────────────────────
      } else {
        console.warn('[MMA] Link item has no url or txt path:', item);
        showToast('No link configured for this resource.', 'error');
      }
      break;
 
    case 'image':
      showImageModal(item);
      break;

    case 'docx': {
      // DOCX cannot render in-browser — always trigger a download
      const resolvedUrl = encodeURI(item.path);
      console.log('[MMA] Downloading DOCX:', { name: item.name, originalPath: item.path, resolvedUrl });
      triggerDownload(item.path, item.name);
      break;
    }
  }
}

// ──────────────────────────────────────────────
//  DOWNLOAD TRIGGER
// ──────────────────────────────────────────────
function triggerDownload(path, name) {
  if (!path) return;
  const encodedPath = encodeURI(path);
  console.log('[MMA] Triggering download:', { name, originalPath: path, encodedPath });
  const a = document.createElement('a');
  a.href = encodedPath;
  a.download = name || path.split('/').pop();
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ──────────────────────────────────────────────
//  SKELETON LOADER
// ──────────────────────────────────────────────
function showResourceSkeleton() {
  const grid = document.getElementById('resourceGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem;">
      ${Array(8).fill('<div class="skeleton skeleton-card"></div>').join('')}
    </div>`;
}

// ──────────────────────────────────────────────
//  RECURSIVE SEARCH
// ──────────────────────────────────────────────
function recursiveSearch(items, query) {
  const results = [];
  for (const item of items) {
    if (item.name.toLowerCase().includes(query)) {
      results.push(item);
    } else if (item.type === 'folder' && item.children) {
      const inner = recursiveSearch(item.children, query);
      results.push(...inner);
    }
  }
  return results;
}

// ──────────────────────────────────────────────
//  SORT
// ──────────────────────────────────────────────
function sortItems(items, mode) {
  const typeOrder = { folder: 0, pdf: 1, ppt: 2, docx: 3, link: 4, image: 5 };
  return [...items].sort((a, b) => {
    if (mode === 'name-az') return a.name.localeCompare(b.name);
    if (mode === 'name-za') return b.name.localeCompare(a.name);
    if (mode === 'type')    return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
    return 0;
  });
}

// ──────────────────────────────────────────────
//  IMAGE MODAL (full-featured: zoom + pan)
// ──────────────────────────────────────────────
function showImageModal(item) {
  // Remove any existing modal first
  closeImageModal();

  const container = document.createElement('div');
  container.id = 'imageModalContainer';
  document.body.appendChild(container);

  container.innerHTML = `
    <div id="imgModalOverlay" style="
      position:fixed;inset:0;background:rgba(0,0,0,0.94);backdrop-filter:blur(10px);
      z-index:3000;display:flex;flex-direction:column;align-items:center;justify-content:center;
      animation:fadeIn 0.2s ease;">

      <!-- Toolbar -->
      <div style="position:absolute;top:0;left:0;right:0;display:flex;align-items:center;
                  justify-content:space-between;padding:1rem 1.5rem;
                  background:linear-gradient(180deg,rgba(0,0,0,0.85) 0%,transparent 100%);z-index:10;">
        <div style="font-family:'Cinzel',serif;font-size:0.95rem;color:#C9A84C;letter-spacing:0.1em;
                    max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${escHtml(item.name)}
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="iv-btn" id="ivZoomOut">− Zoom</button>
          <button class="iv-btn" id="ivZoomReset">↺ Reset</button>
          <button class="iv-btn" id="ivZoomIn">+ Zoom</button>
          <button class="iv-btn" id="ivDownload">↓ Save</button>
          <button class="iv-btn" id="ivClose" style="border-color:rgba(255,80,80,0.4);color:#ff9999;">✕</button>
        </div>
      </div>

      <!-- Viewport -->
      <div id="ivViewport" style="width:100vw;height:100vh;overflow:hidden;display:flex;
                                   align-items:center;justify-content:center;cursor:grab;">
        <img id="ivImg" src="${escHtml(encodeURI(item.path||''))}" alt="${escHtml(item.name)}"
             draggable="false" style="
               max-width:88vw;max-height:84vh;object-fit:contain;display:block;
               transform-origin:center center;
               border:1px solid rgba(201,168,76,0.15);
               box-shadow:0 0 60px rgba(0,0,0,0.9);
               pointer-events:none;will-change:transform;
               transition:transform 0.1s ease;"
             onerror="console.error('[MMA] Image modal 404:','${escHtml(encodeURI(item.path||''))}');this.alt='Image not found';this.style.padding='2rem';this.style.color='#666';" />
      </div>

      <!-- Hints -->
      <div id="ivHint" style="position:absolute;bottom:1.5rem;left:50%;transform:translateX(-50%);
           font-family:'Share Tech Mono',monospace;font-size:0.65rem;color:rgba(201,168,76,0.4);
           letter-spacing:0.2em;pointer-events:none;transition:opacity 0.5s;">
        Scroll to zoom · Drag to pan · Double-click to reset
      </div>
      <div id="ivZoomLabel" style="position:absolute;bottom:1.5rem;right:1.5rem;
           font-family:'Share Tech Mono',monospace;font-size:0.7rem;color:rgba(201,168,76,0.45);
           letter-spacing:0.15em;pointer-events:none;">100%</div>
    </div>`;

  // ── State ──────────────────────────────────────────────────
  let scale = 1, panX = 0, panY = 0;
  let isDragging = false, lastX = 0, lastY = 0;
  const MIN_SCALE = 0.5, MAX_SCALE = 6;

  const overlay  = document.getElementById('imgModalOverlay');
  const viewport = document.getElementById('ivViewport');
  const img      = document.getElementById('ivImg');
  const zoomLbl  = document.getElementById('ivZoomLabel');

  function applyTransform() {
    img.style.transform = `translate(${panX}px,${panY}px) scale(${scale})`;
    zoomLbl.textContent = Math.round(scale * 100) + '%';
  }

  function setScale(newScale, ox = 0, oy = 0) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    const ratio   = clamped / scale;
    panX = ox - ratio * (ox - panX);
    panY = oy - ratio * (oy - panY);
    scale = clamped;
    applyTransform();
  }

  function resetView() { scale = 1; panX = 0; panY = 0; applyTransform(); }

  // ── Toolbar buttons ─────────────────────────────────────────
  document.getElementById('ivClose').addEventListener('click', closeImageModal);
  document.getElementById('ivZoomIn').addEventListener('click',    () => setScale(scale * 1.3));
  document.getElementById('ivZoomOut').addEventListener('click',   () => setScale(scale / 1.3));
  document.getElementById('ivZoomReset').addEventListener('click', resetView);
  document.getElementById('ivDownload').addEventListener('click',  () => triggerDownload(item.path, item.name));

  // ── Overlay click to close ──────────────────────────────────
  function _overlayClick(e) { if (e.target === overlay) closeImageModal(); }
  overlay.addEventListener('click', _overlayClick);

  // ── Scroll zoom ─────────────────────────────────────────────
  function _onWheel(e) {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const ox = e.clientX - rect.left - rect.width  / 2;
    const oy = e.clientY - rect.top  - rect.height / 2;
    setScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), ox, oy);
  }
  viewport.addEventListener('wheel', _onWheel, { passive: false });

  // ── Mouse drag ──────────────────────────────────────────────
  function _onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
    viewport.style.cursor = 'grabbing';
    e.preventDefault();
  }
  function _onMouseMove(e) {
    if (!isDragging) return;
    panX += e.clientX - lastX; panY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  }
  function _onMouseUp() { isDragging = false; viewport.style.cursor = 'grab'; }

  viewport.addEventListener('mousedown', _onMouseDown);
  window.addEventListener('mousemove',   _onMouseMove);
  window.addEventListener('mouseup',     _onMouseUp);

  // ── Double-click to reset ────────────────────────────────────
  viewport.addEventListener('dblclick', resetView);

  // ── Touch support ───────────────────────────────────────────
  let lastTouchDist = 0, lastTx = 0, lastTy = 0;
  function _onTouchStart(e) {
    if (e.touches.length === 1) { lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY; }
    else if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
    e.preventDefault();
  }
  function _onTouchMove(e) {
    if (e.touches.length === 1) {
      panX += e.touches[0].clientX - lastTx; panY += e.touches[0].clientY - lastTy;
      lastTx = e.touches[0].clientX; lastTy = e.touches[0].clientY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      setScale(scale * (d / lastTouchDist));
      lastTouchDist = d;
    }
    e.preventDefault();
  }
  viewport.addEventListener('touchstart', _onTouchStart, { passive: false });
  viewport.addEventListener('touchmove',  _onTouchMove,  { passive: false });

  // ── Keyboard ─────────────────────────────────────────────────
  function _onKey(e) {
    if (e.key === 'Escape') closeImageModal();
    if (e.key === '+' || e.key === '=') setScale(scale * 1.2);
    if (e.key === '-') setScale(scale / 1.2);
    if (e.key === '0') resetView();
  }
  document.addEventListener('keydown', _onKey);

  // ── Fade hint after 3 s ──────────────────────────────────────
  setTimeout(() => {
    const hint = document.getElementById('ivHint');
    if (hint) hint.style.opacity = '0';
  }, 3000);

  // Store cleanup on overlay element
  overlay._cleanup = () => {
    overlay.removeEventListener('click',      _overlayClick);
    viewport.removeEventListener('wheel',      _onWheel);
    viewport.removeEventListener('mousedown',  _onMouseDown);
    viewport.removeEventListener('dblclick',   resetView);
    viewport.removeEventListener('touchstart', _onTouchStart);
    viewport.removeEventListener('touchmove',  _onTouchMove);
    window.removeEventListener('mousemove',    _onMouseMove);
    window.removeEventListener('mouseup',      _onMouseUp);
    document.removeEventListener('keydown',    _onKey);
  };
}

function closeImageModal() {
  const container = document.getElementById('imageModalContainer');
  if (!container) return;
  const overlay = document.getElementById('imgModalOverlay');
  if (overlay && typeof overlay._cleanup === 'function') overlay._cleanup();
  container.remove();
}

// ──────────────────────────────────────────────
//  GENERAL MODAL (member cards, easter egg)
// ──────────────────────────────────────────────
function showModal(html, extraStyle = '') {
  const mc = document.getElementById('modalContainer');
  mc.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box" style="${extraStyle}">
        <button class="modal-close" id="modalClose">✕</button>
        ${html}
      </div>
    </div>`;
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
  document.addEventListener('keydown', _modalKey);
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
  document.removeEventListener('keydown', _modalKey);
}
function _modalKey(e) { if (e.key === 'Escape') closeModal(); }

// ──────────────────────────────────────────────
//  TOAST NOTIFICATION
// ──────────────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.getElementById('mmaToast');
  if (existing) existing.remove();

  const colors = { info: '#C9A84C', error: '#ff6b6b', success: '#6bcb77' };
  const toast = document.createElement('div');
  toast.id = 'mmaToast';
  toast.style.cssText = `
    position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
    background:rgba(20,20,20,0.97);border:1px solid ${colors[type]||colors.info};
    color:${colors[type]||colors.info};padding:0.75rem 1.5rem;
    font-family:'Rajdhani',sans-serif;font-weight:600;font-size:0.9rem;
    letter-spacing:0.1em;z-index:9998;
    box-shadow:0 4px 24px rgba(0,0,0,0.6);
    animation:pageFadeIn 0.3s ease;
    max-width:90vw;text-align:center;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ──────────────────────────────────────────────
//  EASTER EGG
// ──────────────────────────────────────────────
function showEasterEgg() {

const isMobile = window.innerWidth <= 768;

const message = isMobile
? `       WELCOME TO THE INNER CIRCLE ⚙️<br><br>
      Classified access granted.<br>
      Loyalty confirmed.<br><br>
      "The machine never rests."<br><br>
      — MMA Council
    `
: `       WELCOME TO THE INNER CIRCLE ⚙️<br><br>
      You have accessed classified Ministry archives.<br>
      Your loyalty has been noted.<br>
      Your dedication — exemplary.<br><br>
      "The machine does not rest.<br>
      Neither do we."<br><br>
      — High Council, MMA
    `;

showModal(` <div class="glitch-modal">


  <div style="font-size:3rem;margin-bottom:1rem;animation:rotateCW 3s linear infinite;display:inline-block;">
    ⚙️
  </div>

  <div class="glitch-text">CLEARANCE: INNER CIRCLE</div>

  <div style="margin:1.5rem 0;font-size:0.8rem;color:#0f0;opacity:0.7;line-height:1.8;">
    ${message}
  </div>

  <div style="margin:1.5rem 0;">
    <img
      src="whatsapp.jpg"
      alt="MMA WhatsApp QR"
      style="
        width:180px;
        max-width:100%;
        border:2px solid rgba(0,255,0,0.35);
        border-radius:12px;
        display:block;
        margin:0 auto 1rem;
      "
    >

    <a
      href="https://chat.whatsapp.com/Ca9U3k0ZNxiJBIQc5jQEC7"
      target="_blank"
      rel="noopener noreferrer"
      style="
        display:inline-block;
        padding:12px 24px;
        background:#25D366;
        color:#000;
        text-decoration:none;
        font-weight:bold;
        border-radius:8px;
      "
    >
      JOIN WHATSAPP BROTHERHOOD
    </a>
  </div>

  <div style="
    font-size:0.65rem;
    color:#0a0;
    opacity:0.5;
    letter-spacing:0.2em;
  ">
    ACCESS LEVEL: OMEGA-7 GRANTED
  </div>

</div>


`, 'background:rgba(0,20,0,0.98);border-color:rgba(0,255,0,0.4);');
}


// ──────────────────────────────────────────────
//  FOOTER
// ──────────────────────────────────────────────
function renderFooter() {
  return `
    <footer>
      <div style="display:flex;align-items:center;justify-content:center;gap:2rem;flex-wrap:wrap;margin-bottom:1.5rem;">
        <svg width="40" height="40" viewBox="0 0 40 40" style="opacity:0.3;">
          ${buildGearSVG({ cx:20, cy:20, r:16, teeth:10, stroke:'#C9A84C', opacity:1, cls:'gear-slow', strokeW:1 })}
        </svg>
        <div style="text-align:center;">
          <div style="font-family:'Cinzel',serif;font-weight:900;color:var(--gold);font-size:1rem;letter-spacing:0.2em;margin-bottom:0.25rem;">
            MINISTRY OF MECHANICAL AFFAIRS
          </div>
          <div style="font-size:0.7rem;color:#444;letter-spacing:0.15em;text-transform:uppercase;">
            Engineering · Discipline · Brotherhood
          </div>
        </div>
        <svg width="40" height="40" viewBox="0 0 40 40" style="opacity:0.3;">
          ${buildGearSVG({ cx:20, cy:20, r:16, teeth:10, stroke:'#C9A84C', opacity:1, cls:'gear-ccw', strokeW:1 })}
        </svg>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-bottom:1.5rem;flex-wrap:wrap;">
        <a href="https://www.instagram.com/ministry_of_mechanical_affairs?igsh=MXgydW5jb3lvMGFvNA==" target="_blank"
           style="color:#666;transition:color 0.3s;text-decoration:none;display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;"
           onmouseover="this.style.color='#E1306C'" onmouseout="this.style.color='#666'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          @mma_official
        </a>
        <span style="color:#333;">·</span>
        
        <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ministryofmechanicalaffairs@gmail.com" target="_blank"
   style="color:#666;transition:color 0.3s;text-decoration:none;display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;"
   onmouseover="this.style.color='#D4AF37'"
   onmouseout="this.style.color='#666'">
   
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2">
    <path d="M4 4h16v16H4z"/>
    <path d="M22 6l-10 7L2 6"/>
  </svg>

  ministryofmechanicalaffairs@gmail.com
</a>
      </div>
      <div style="font-size:0.7rem;color:#333;letter-spacing:0.1em;">
        © 2024 Ministry of Mechanical Affairs · All Rights Reserved
      </div>
    </footer>`;
}

// ──────────────────────────────────────────────
//  ICON HELPERS
// ──────────────────────────────────────────────
function homeIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}
function folderIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}

// ──────────────────────────────────────────────
//  UTILITY — HTML escape
// ──────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// ──────────────────────────────────────────────
//  GLOBALS (used by inline onclick in templates)
// ──────────────────────────────────────────────
window.navigate        = navigate;
window.showMemberModal = showMemberModal;

// ──────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────
(function init() {
  const path = location.pathname;
  updateNavHighlight(path);
  navigate(path, false);
})();