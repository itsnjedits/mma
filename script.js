/**
 * ============================================================
 *  MINISTRY OF MECHANICAL AFFAIRS — SPA Engine
 *  script.js  (v3 — system audit & fix)
 * ============================================================
 *
 *  FIXES IN THIS VERSION:
 *  [1] resources.json fetch path: 'resources.json' (root-level)
 *  [2] Image modal: named event handlers so they clean up properly
 *  [3] openLink: visual loading indicator on the card while fetching
 *  [4] openLink: robust error handling with user-visible toast
 *  [5] All card click/download listeners scoped correctly
 *  [6] No more stray window-level listener leaks
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────────
//  DATA: Members
// ──────────────────────────────────────────────
const MEMBERS = [
  {
    id: 1, initials: 'AK', name: 'Arjun Khanna', role: 'Chief Architect',
    dept: 'Mechanical Engineering – IV Year',
    bio: 'Visionary behind the Ministry\'s founding principles. Specializes in thermodynamic system design and led the team that won the National Robotics Championship 2023. Known for turning constraints into masterpieces.',
    skills: ['Thermal Systems', 'Robotics', 'CAD/CAM', 'Leadership'],
  },
  {
    id: 2, initials: 'RS', name: 'Rohan Sharma', role: 'Gear Marshal',
    dept: 'Mechanical Engineering – III Year',
    bio: 'The man who understands machines like they breathe. Expert in gear transmission systems and precision manufacturing. Has filed 2 patents on micro-actuator designs.',
    skills: ['Gear Design', 'Manufacturing', 'Metrology', 'Dynamics'],
  },
  {
    id: 3, initials: 'PV', name: 'Priya Verma', role: 'Fluid Commander',
    dept: 'Mechanical Engineering – III Year',
    bio: 'Master of fluid dynamics and heat transfer. Leads the computational simulation wing and has published research on turbulent flow optimization in industrial ducts.',
    skills: ['CFD', 'Heat Transfer', 'ANSYS', 'Research'],
  },
  {
    id: 4, initials: 'DM', name: 'Dev Mehta', role: 'Materials Warden',
    dept: 'Mechanical Engineering – II Year',
    bio: 'A rising star who bridged metallurgy and design thinking. His material selection framework has been adopted by 3 student project teams. Passionate about composite engineering.',
    skills: ['Metallurgy', 'Composites', 'Testing', 'Design'],
  },
  {
    id: 5, initials: 'SR', name: 'Sneha Rao', role: 'Systems Analyst',
    dept: 'Mechanical Engineering – IV Year',
    bio: 'The analytical mind of the Ministry. Builds simulation models for vibration analysis and structural integrity. Her failure mode analysis saved a critical SAE vehicle project.',
    skills: ['FEA', 'Vibration Analysis', 'MATLAB', 'Project Mgmt'],
  },
  {
    id: 6, initials: 'VK', name: 'Vikram Kumar', role: 'Workshop Head',
    dept: 'Mechanical Engineering – II Year',
    bio: 'Hands-on builder and workshop maestro. Can fabricate anything from raw stock to finished component. Leads hands-on training sessions for junior members every semester.',
    skills: ['Machining', 'Welding', 'CNC', 'Fabrication'],
  },
];

// ──────────────────────────────────────────────
//  DATA: Council
// ──────────────────────────────────────────────
const COUNCIL = [
  {
    initials: 'AK', name: 'Arjun Khanna', role: 'Founder',
    desc: 'Established the Ministry with a vision to create a brotherhood where engineering meets excellence. His leadership forged the original charter.',
    icon: '⚙️',
  },
  {
    initials: 'PV', name: 'Priya Verma', role: 'Co-Founder',
    desc: 'Architect of the Ministry\'s academic framework. Designed the mentorship pipeline and resource management systems still in use today.',
    icon: '🔧',
  },
  {
    initials: 'RS', name: 'Rohan Sharma', role: 'Chief Commander',
    desc: 'Oversees daily operations of the Ministry. Coordinates between chapters, manages project pipelines, and ensures the Brotherhood\'s standards are upheld.',
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
//  GEAR SVG BUILDER  (background / footer use)
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
//  PERPETUAL MOTION MACHINE
//  Mechanically coherent gear train:
//  G1 (r=52, 16t, CW, 14s) → G2 (r=33, 10t, CCW, 8.75s)
//  G2 → G3 (r=20, 6t, CW, 5.25s)
//  G2 shaft → belt → flywheel (CW, 8.75s)
//  Pendulum on G1 pivot column
// ──────────────────────────────────────────────
function buildPMM() {
  const gold   = '#C9A84C';
  const goldD  = '#9A7530';
  const goldL  = '#E8C96A';
  const blue   = '#4A90E2';
  const steel  = '#2C2C2C';
  const steelL = '#4A4A4A';

  function gearPath(cx, cy, r, teeth) {
    const toothH = r * 0.20;
    const inner  = r - toothH;
    const step   = (2 * Math.PI) / teeth;
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a1 = i * step - step * 0.35;
      const a2 = i * step - step * 0.1;
      const a3 = i * step + step * 0.1;
      const a4 = i * step + step * 0.35;
      d += `L ${cx + inner*Math.cos(a1)} ${cy + inner*Math.sin(a1)} `;
      d += `L ${cx + r    *Math.cos(a2)} ${cy + r    *Math.sin(a2)} `;
      d += `L ${cx + r    *Math.cos(a3)} ${cy + r    *Math.sin(a3)} `;
      d += `L ${cx + inner*Math.cos(a4)} ${cy + inner*Math.sin(a4)} `;
    }
    return 'M' + d.slice(1) + 'Z';
  }

  function spokes(cx, cy, r, n, col) {
    const inner = r * 0.80;
    return Array.from({ length: n }, (_, i) => {
      const a = (Math.PI * 2 / n) * i;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + inner*Math.cos(a)}" y2="${cy + inner*Math.sin(a)}" stroke="${col}" stroke-width="1.2" opacity="0.55"/>`;
    }).join('');
  }

  function gear(cx, cy, r, teeth, animClass, col, spokeCount) {
    const inner = r * 0.80;
    return `
      <g class="${animClass}" style="transform-origin:${cx}px ${cy}px;">
        <path d="${gearPath(cx, cy, r, teeth)}" stroke="${col}" stroke-width="1.5" fill="none" opacity="0.88"/>
        ${spokes(cx, cy, inner, spokeCount, col)}
        <circle cx="${cx}" cy="${cy}" r="${r * 0.19}" stroke="${col}" stroke-width="1.5" fill="${steel}" opacity="0.95"/>
        <circle cx="${cx}" cy="${cy}" r="${r * 0.08}" fill="${col}" opacity="0.95"/>
      </g>`;
  }

  const g1cx = 135, g1cy = 155, g1r = 52, g1t = 16;
  const g2cx = 254, g2cy = 155, g2r = 33, g2t = 10;
  const g3cx = 316, g3cy = 108, g3r = 20, g3t = 6;

  return `
<svg viewBox="0 0 520 270" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
  <defs>
    <filter id="pmm-glow-gold">
      <feGaussianBlur stdDeviation="2.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="pmm-glow-blue">
      <feGaussianBlur stdDeviation="2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="fw-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${goldL}" stop-opacity="0.9"/>
      <stop offset="50%"  stop-color="${gold}"  stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${goldD}" stop-opacity="0.8"/>
    </linearGradient>
  </defs>

  <!-- Base plate -->
  <rect x="20" y="228" width="480" height="5" rx="2" fill="${steelL}" opacity="0.55"/>
  <rect x="40" y="233" width="440" height="2" rx="1" fill="${goldD}"  opacity="0.25"/>

  <!-- Support pillars -->
  <rect x="${g1cx - 3}" y="${g1cy + g1r}" width="6" height="${228 - g1cy - g1r}" fill="${steelL}" opacity="0.5"/>
  <rect x="${g2cx - 3}" y="${g2cy + g2r}" width="6" height="${228 - g2cy - g2r}" fill="${steelL}" opacity="0.4"/>
  <rect x="405"         y="190"           width="6" height="38"                   fill="${steelL}" opacity="0.35"/>

  <!-- Axle labels -->
  <text x="${g1cx}" y="248" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6.5" fill="${goldD}" opacity="0.45" letter-spacing="1">DRIVE SHAFT</text>
  <text x="${g2cx}" y="248" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6.5" fill="${goldD}" opacity="0.45" letter-spacing="1">OUTPUT</text>
  <text x="408"     y="248" text-anchor="middle" font-family="Share Tech Mono,monospace" font-size="6.5" fill="${goldD}" opacity="0.35" letter-spacing="1">FLYWHEEL</text>

  <!-- Belt: G2 axle → far-right flywheel -->
  <line x1="${g2cx}" y1="${g2cy - 8}" x2="408" y2="172"
    stroke="${goldD}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.3"
    style="animation: beltFlow 3s linear infinite;"/>
  <line x1="${g2cx}" y1="${g2cy + 8}" x2="408" y2="190"
    stroke="${goldD}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.25"
    style="animation: beltFlow 3s linear infinite reverse;"/>

  <!-- Far-right flywheel (belt-driven, CW, same speed as G2) -->
  <g class="pmm-gear-med" style="transform-origin:408px 181px;">
    <circle cx="408" cy="181" r="30" stroke="${gold}" stroke-width="2" fill="none" opacity="0.65" filter="url(#pmm-glow-gold)"/>
    <circle cx="408" cy="181" r="22" stroke="${goldD}" stroke-width="1" fill="none" opacity="0.35"/>
    ${Array.from({length:6},(_,i)=>{const a=(Math.PI/3)*i;return `<line x1="408" y1="181" x2="${408+26*Math.cos(a)}" y2="${181+26*Math.sin(a)}" stroke="${gold}" stroke-width="1.2" opacity="0.5"/>`;}).join('')}
    <circle cx="408" cy="181" r="7" fill="${steelL}" stroke="${gold}" stroke-width="1.2" opacity="0.9"/>
    <circle cx="408" cy="181" r="2.5" fill="${gold}" opacity="1"/>
    <ellipse cx="408" cy="153" rx="7" ry="4.5" fill="${goldD}" opacity="0.6"/>
  </g>

  <!-- G1: main drive gear (CW, 14s) -->
  ${gear(g1cx, g1cy, g1r, g1t, 'pmm-gear-cw', gold, 5)}

  <!-- G2: medium meshing gear (CCW, 8.75s) -->
  ${gear(g2cx, g2cy, g2r, g2t, 'pmm-gear-ccw', goldL, 4)}

  <!-- G3: small top gear (CW, 5.25s) -->
  ${gear(g3cx, g3cy, g3r, g3t, 'pmm-gear-fast', blue, 3)}

  <!-- Pendulum on G1 pivot column -->
  <g class="pmm-pendulum" style="transform-origin:${g1cx}px 48px;">
    <rect x="${g1cx - 6}" y="43" width="12" height="7" rx="2" fill="${steel}" stroke="${goldD}" stroke-width="1" opacity="0.8"/>
    <line x1="${g1cx}" y1="48" x2="${g1cx}" y2="110" stroke="${gold}" stroke-width="1.8" opacity="0.6"/>
    <circle cx="${g1cx}" cy="79"  r="3.5" fill="none" stroke="${goldD}" stroke-width="1.2" opacity="0.45"/>
    <circle cx="${g1cx}" cy="114" r="9" fill="${steelL}" stroke="${gold}" stroke-width="1.8" filter="url(#pmm-glow-gold)" opacity="0.88"/>
    <circle cx="${g1cx}" cy="114" r="3.5" fill="${gold}" opacity="0.9"/>
  </g>

  <!-- Spark pulses at gear mesh points -->
  <circle cx="${g3cx}" cy="${g3cy}" r="3" fill="${blue}" class="pmm-spark"  filter="url(#pmm-glow-blue)" opacity="0"/>
  <circle cx="${g2cx}" cy="${g2cy}" r="3" fill="${gold}" class="pmm-spark2" filter="url(#pmm-glow-gold)" opacity="0"/>
</svg>`;
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
          ${buildGearSVG({ cx:80,  cy:120, r:60,  teeth:12, stroke:'#C9A84C', opacity:0.12, cls:'gear-cw' })}
          ${buildGearSVG({ cx:180, cy:90,  r:30,  teeth:8,  stroke:'#C9A84C', opacity:0.10, cls:'gear-ccw' })}
          ${buildGearSVG({ cx:1120,cy:650, r:80,  teeth:16, stroke:'#C9A84C', opacity:0.10, cls:'gear-cw' })}
          ${buildGearSVG({ cx:1000,cy:700, r:40,  teeth:10, stroke:'#4A90E2', opacity:0.08, cls:'gear-ccw' })}
          ${buildGearSVG({ cx:600, cy:750, r:50,  teeth:12, stroke:'#C9A84C', opacity:0.06, cls:'gear-slow' })}
          ${buildGearSVG({ cx:200, cy:750, r:35,  teeth:9,  stroke:'#4A90E2', opacity:0.07, cls:'gear-ccw' })}
          ${buildGearSVG({ cx:1050,cy:100, r:45,  teeth:10, stroke:'#C9A84C', opacity:0.09, cls:'gear-slow' })}
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

      <!-- ══ PERPETUAL MOTION MACHINE ══ -->
      <div class="pmm-wrapper">
        <div style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;letter-spacing:0.3em;color:rgba(201,168,76,0.3);text-align:center;margin-bottom:0.75rem;text-transform:uppercase;">
          ⚙ Perpetual Motion Assembly · da Vinci Class ⚙
        </div>
        ${buildPMM()}
        <div style="font-family:'Share Tech Mono',monospace;font-size:0.55rem;letter-spacing:0.2em;color:rgba(201,168,76,0.2);text-align:center;margin-top:0.5rem;text-transform:uppercase;">
          [ The machine does not rest. Neither do we. ]
        </div>
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
        <div class="stat-card"><div class="stat-icon">⚙️</div><div class="stat-number">42+</div><div class="stat-label">Active Members</div></div>
        <div class="stat-card"><div class="stat-icon">📍</div><div class="stat-number">Jaipur</div><div class="stat-label">Rajasthan, India</div></div>
        <div class="stat-card"><div class="stat-icon">🏛️</div><div class="stat-number">2022</div><div class="stat-label">Founded Year</div></div>
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
        ${m.skills.map(s => `<span style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);color:#C9A84C;padding:0.25rem 0.75rem;font-size:0.75rem;letter-spacing:0.15em;text-transform:uppercase;">${s}</span>`).join('')}
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
      <h1 class="section-title" style="font-size:clamp(2rem,5vw,3.5rem);">
        We Are Not Just A <span>Club</span>
      </h1>
      <div class="section-line"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start;" class="about-grid">
        <div>
          <p style="color:#999;font-size:1.05rem;line-height:1.8;margin-bottom:1.5rem;">
            The Ministry of Mechanical Affairs was born not in a classroom — but in a workshop,
            surrounded by the smell of cutting oil and the sound of grinding steel.
          </p>
          <p style="color:#777;font-size:1rem;line-height:1.8;margin-bottom:1.5rem;">
            What started as a study group became a brotherhood. What began as sharing notes
            became sharing ambitions. The Ministry stands today as a testament to discipline and relentless work ethic.
          </p>
          <p style="color:#666;font-size:1rem;line-height:1.8;">
            Every gear has a purpose. Every bolt holds something together.
            <strong style="color:#C9A84C;">So do we.</strong>
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
          { n:'01', t:'Application', d:'Submit your application with a statement of intent and your engineering philosophy.' },
          { n:'02', t:'Eligibility Review', d:'Academic record, extracurriculars, and project portfolio are evaluated. Minimum CGPA of 7.5 required.' },
          { n:'03', t:'Physical Aptitude Test', d:'A hands-on fabrication challenge in the workshop. Tested on problem-solving under pressure.' },
          { n:'04', t:'Mental Calibration Test', d:'Analytical examination covering thermodynamics, mechanics, fluid systems, and design thinking.' },
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
        <a href="mailto:mma.ministry@gmail.com" class="contact-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
          mma.ministry@gmail.com
        </a>
        <a href="https://instagram.com/mma_official" target="_blank" class="contact-btn" style="color:#E1306C;border-color:rgba(225,48,108,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          @mma_official
        </a>
        <a href="tel:+919876543210" class="contact-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.82 12 19.79 19.79 0 0 1 1.77 3.43 2 2 0 0 1 3.74 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.41a16 16 0 0 0 6.72 6.72l1.57-1.57a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          +91 98765 43210
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
          <div class="sidebar-item active" data-folder="root">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            All Resources
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
//  LOAD RESOURCE JSON
//  FIX [1]: fetch from 'resources.json' (root-level)
//  Works on GitHub Pages and local server alike.
// ──────────────────────────────────────────────
async function loadResourceData() {
  showResourceSkeleton();
  try {
    console.log('[MMA] Fetching resources.json …');
    const resp = await fetch('resources.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
    state.resourceData = await resp.json();
    console.log(`[MMA] Loaded ${state.resourceData.length} top-level items`);
  } catch (err) {
    console.error('[MMA] Failed to load resources.json:', err);
    console.warn('[MMA] Falling back to sample data');
    state.resourceData = getSampleResourceData();
  }
  state.resourceStack = [{ name: 'All Resources', items: state.resourceData }];
  populateResourceSidebar();
  renderResourceGrid();
}

// ──────────────────────────────────────────────
//  SAMPLE DATA  (uses txt-path system)
// ──────────────────────────────────────────────
function getSampleResourceData() {
  return [
    {
      name: 'Mechanics', type: 'folder',
      children: [
        { name: 'Engineering Mechanics Notes',  type: 'pdf',   path: 'resources/Mechanics/engineering_mechanics_notes.pdf' },
        { name: 'Free Body Diagram Guide',       type: 'pdf',   path: 'resources/Mechanics/free_body_diagram_guide.pdf' },
        { name: 'Statics and Dynamics Summary',  type: 'pdf',   path: 'resources/Mechanics/statics_dynamics_summary.pdf' },
        { name: 'Statics Explained',   type: 'link', thumbnail: 'resources/Mechanics/statics_explained.jpg',  txt: 'resources/Mechanics/statics_explained.txt' },
        { name: 'Newton Laws Lecture', type: 'link', thumbnail: 'resources/Mechanics/newton_laws.jpg',         txt: 'resources/Mechanics/newton_laws.txt' },
      ],
    },
    {
      name: 'Thermodynamics', type: 'folder',
      children: [
        { name: 'First Law of Thermodynamics', type: 'pdf',   path: 'resources/Thermodynamics/first_law.pdf' },
        { name: 'Second Law and Entropy',       type: 'pdf',   path: 'resources/Thermodynamics/second_law_entropy.pdf' },
        { name: 'Carnot Cycle Notes',           type: 'pdf',   path: 'resources/Thermodynamics/carnot_cycle.pdf' },
        { name: 'Heat Engines Deep Dive', type: 'link', thumbnail: 'resources/Thermodynamics/heat_engines.jpg', txt: 'resources/Thermodynamics/heat_engines.txt' },
        { name: 'PV Diagram Reference',   type: 'image', path: 'resources/Thermodynamics/pv_diagram.jpg' },
      ],
    },
    {
      name: 'Fluid Mechanics', type: 'folder',
      children: [
        { name: 'Bernoulli Theorem Notes',    type: 'pdf',   path: 'resources/FluidMechanics/bernoulli_theorem.pdf' },
        { name: 'Reynolds Number Explained',  type: 'pdf',   path: 'resources/FluidMechanics/reynolds_number.pdf' },
        { name: 'Continuity Equation',        type: 'pdf',   path: 'resources/FluidMechanics/continuity_equation.pdf' },
        { name: 'Fluid Flow Visualization', type: 'link', thumbnail: 'resources/FluidMechanics/fluid_flow.jpg', txt: 'resources/FluidMechanics/fluid_flow.txt' },
        { name: 'Pipe Flow Regimes', type: 'image', path: 'resources/FluidMechanics/pipe_flow.jpg' },
      ],
    },
    {
      name: 'Machine Design', type: 'folder',
      children: [
        { name: 'Gear Design Fundamentals',   type: 'pdf',  path: 'resources/MachineDesign/gear_design.pdf' },
        { name: 'Shaft and Bearing Analysis', type: 'pdf',  path: 'resources/MachineDesign/shaft_bearing.pdf' },
        { name: 'Design of Machine Elements', type: 'link', thumbnail: 'resources/MachineDesign/machine_elements.jpg', txt: 'resources/MachineDesign/machine_elements.txt' },
      ],
    },
    {
      name: 'Manufacturing', type: 'folder',
      children: [
        { name: 'Casting and Forging Notes', type: 'pdf', path: 'resources/Manufacturing/casting_forging.pdf' },
        { name: 'CNC Machining Guide',       type: 'pdf', path: 'resources/Manufacturing/cnc_machining.pdf' },
        { name: 'Welding Techniques',        type: 'pdf', path: 'resources/Manufacturing/welding_techniques.pdf' },
      ],
    },
    { name: 'Ministry Handbook',        type: 'pdf',   path: 'resources/ministry_handbook.pdf' },
    { name: 'Workshop Safety Protocol', type: 'pdf',   path: 'resources/workshop_safety.pdf' },
    { name: 'MMA Logo High Resolution', type: 'image', path: 'resources/mma_logo.png' },
  ];
}

// ──────────────────────────────────────────────
//  SIDEBAR
// ──────────────────────────────────────────────
function populateResourceSidebar() {
  const sidebar = document.getElementById('sidebarItems');
  if (!sidebar) return;
  const folders = state.resourceData.filter(i => i.type === 'folder');

  const items = [
    { folder: null, label: 'All Resources', icon: homeIcon() },
    ...folders.map(f => ({ folder: f, label: f.name, icon: folderIcon() })),
  ];

  sidebar.innerHTML = items.map((item, idx) => `
    <div class="sidebar-item ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
      ${item.icon}
      ${item.label}
    </div>
  `).join('');

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
          { name: folder.name, items: folder.children || [] },
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
        <span class="breadcrumb-item" style="${isLast ? 'color:#C9A84C;' : ''}" data-level="${i}">${level.name}</span>
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
  let items = current.items || [];

  if (state.searchQuery.trim()) {
    items = recursiveSearch(items, state.searchQuery.toLowerCase());
  }
  items = sortItems([...items], state.sortMode);

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚙️</div>
        <div class="empty-state-text">No resources found here yet.</div>
        <div style="margin-top:0.5rem;font-size:0.8rem;color:#333;">The Ministry's archives are being compiled.</div>
      </div>`;
    return;
  }

  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1.25rem;">
      ${items.map(item => renderResourceCard(item)).join('')}
    </div>`;

  // Card click: delegate via data-card attribute
  grid.querySelectorAll('[data-card]').forEach(el => {
    el.addEventListener('click', () => handleCardClick(el.dataset.card, items));
  });

  // Download button: stop propagation so it doesn't also trigger the card click
  grid.querySelectorAll('[data-download]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      triggerDownload(el.dataset.download);
    });
  });

  // Lazy-load images
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
//  CARD CLICK HANDLER
// ──────────────────────────────────────────────
function handleCardClick(name, items) {
  const item = items.find(i => i.name === name);
  if (!item) return;
  switch (item.type) {
    case 'folder':
      state.resourceStack.push({ name: item.name, items: item.children || [] });
      renderResourceGrid();
      break;
    case 'pdf':
      window.open(item.path, '_blank', 'noopener,noreferrer');
      break;
    case 'link':
      openLink(item.txt, name);
      break;
    case 'image':
      showImageModal(item);
      break;
  }
}

// ──────────────────────────────────────────────
//  LINK OPENER
//  FIX [3]: show a visual indicator on the card;
//  display a toast on error so the user knows
// ──────────────────────────────────────────────
async function openLink(txtPath, cardName) {
  if (!txtPath) { showToast('No link file configured for this resource.', 'error'); return; }

  // Show loading state on the card if still visible
  const cardEl = document.querySelector(`[data-card="${CSS.escape(cardName)}"]`);
  const playBtn = cardEl ? cardEl.querySelector('.link-play-btn') : null;
  if (playBtn) {
    playBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" stroke-width="2.5" style="animation:rotateCW 0.8s linear infinite;transform-origin:center"><circle cx="12" cy="12" r="9" stroke-dasharray="30 10"/></svg>`;
  }

  try {
    console.log('[MMA] Fetching link from:', txtPath);
    const res = await fetch(txtPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const link = (await res.text()).trim();
    if (!link) throw new Error('Link file is empty');
    console.log('[MMA] Opening:', link);
    window.open(link, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('[MMA] openLink failed:', err);
    showToast('Could not open link — file may be missing or network error.', 'error');
  } finally {
    // Restore play button
    if (playBtn) {
      playBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#0D0D0D"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
  }
}

// ──────────────────────────────────────────────
//  TOAST NOTIFICATION
// ──────────────────────────────────────────────
function showToast(message, type = 'info') {
  const existing = document.getElementById('mmaToast');
  if (existing) existing.remove();

  const colors = {
    info:    { bg: 'rgba(74,144,226,0.15)', border: 'rgba(74,144,226,0.4)',   text: '#7BB8F0' },
    error:   { bg: 'rgba(220,50,50,0.15)',  border: 'rgba(220,50,50,0.4)',    text: '#F08080' },
    success: { bg: 'rgba(50,180,80,0.15)',  border: 'rgba(50,180,80,0.4)',    text: '#80D080' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.id = 'mmaToast';
  toast.style.cssText = `
    position:fixed; bottom:2rem; left:50%; transform:translateX(-50%);
    background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
    padding:0.75rem 1.5rem; font-family:'Rajdhani',sans-serif; font-size:0.9rem;
    font-weight:600; letter-spacing:0.08em; z-index:5000;
    backdrop-filter:blur(8px); max-width:90vw; text-align:center;
    animation:pageFadeIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
}

// ──────────────────────────────────────────────
//  DOWNLOAD HELPER
// ──────────────────────────────────────────────
function triggerDownload(path) {
  if (!path) return;
  const a = document.createElement('a');
  a.href = path;
  a.download = path.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ──────────────────────────────────────────────
//  RESOURCE CARD RENDERER
// ──────────────────────────────────────────────
function renderResourceCard(item) {
  const base = 'resource-card';
  switch (item.type) {

    case 'folder':
      return `
        <div class="${base}" data-card="${escHtml(item.name)}" style="border-color:rgba(201,168,76,0.2);">
          <div class="resource-card-icon">📁</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type">Folder · ${(item.children||[]).length} items</div>
        </div>`;

    case 'pdf':
      return `
        <div class="${base}" data-card="${escHtml(item.name)}">
          <div class="resource-card-icon">📄</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type">PDF Document</div>
          <div class="download-btn" data-download="${escHtml(item.path||'')}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </div>
        </div>`;

    case 'link':
      return `
        <div class="${base}" data-card="${escHtml(item.name)}" style="padding:0;overflow:hidden;">
          <div style="position:relative;">
            ${item.thumbnail
              ? `<img data-src="${escHtml(item.thumbnail)}" src="" alt="${escHtml(item.name)}" class="resource-card-thumb" style="display:block;min-height:100px;background:#1A1A1A;" onerror="this.style.display='none'" />`
              : `<div style="height:100px;background:rgba(74,144,226,0.08);display:flex;align-items:center;justify-content:center;font-size:2.5rem;">🎬</div>`
            }
            <div class="link-play-overlay">
              <div class="link-play-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0D0D0D"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
          </div>
          <div style="padding:0.85rem;">
            <div class="resource-card-name">${escHtml(item.name)}</div>
            <div class="resource-card-type" style="margin-top:0.25rem;">Video / Link</div>
          </div>
        </div>`;

    case 'image':
      return `
        <div class="${base}" data-card="${escHtml(item.name)}" style="padding:0;overflow:hidden;">
          <div style="position:relative;">
            <img data-src="${escHtml(item.path||'')}" src="" alt="${escHtml(item.name)}" class="resource-card-thumb" style="display:block;min-height:100px;background:#1A1A1A;" onerror="this.style.display='none'" />
            <div class="img-card-dl" data-download="${escHtml(item.path||'')}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
          </div>
          <div style="padding:0.85rem;">
            <div class="resource-card-name">${escHtml(item.name)}</div>
            <div class="resource-card-type" style="margin-top:0.25rem;">Image</div>
          </div>
        </div>`;

    default:
      return `
        <div class="${base}" data-card="${escHtml(item.name)}">
          <div class="resource-card-icon">📎</div>
          <div class="resource-card-name">${escHtml(item.name)}</div>
          <div class="resource-card-type">File</div>
        </div>`;
  }
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
//  SEARCH (RECURSIVE)
// ──────────────────────────────────────────────
function recursiveSearch(items, query) {
  const results = [];
  for (const item of items) {
    if (item.name.toLowerCase().includes(query)) {
      results.push(item);
    } else if (item.type === 'folder' && item.children) {
      const inner = recursiveSearch(item.children, query);
      if (inner.length) results.push(...inner);
    }
  }
  return results;
}

// ──────────────────────────────────────────────
//  SORT
// ──────────────────────────────────────────────
function sortItems(items, mode) {
  const order = { folder: 0, pdf: 1, link: 2, image: 3 };
  return items.sort((a, b) => {
    if (mode === 'name-az') return a.name.localeCompare(b.name);
    if (mode === 'name-za') return b.name.localeCompare(a.name);
    if (mode === 'type')    return (order[a.type]||9) - (order[b.type]||9);
    return 0;
  });
}

// ──────────────────────────────────────────────
//  MODAL — member / easter egg / general
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
  document.addEventListener('keydown', _modalKeyHandler);
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
  document.removeEventListener('keydown', _modalKeyHandler);
}

function _modalKeyHandler(e) {
  if (e.key === 'Escape') closeModal();
}

// ──────────────────────────────────────────────
//  IMAGE MODAL — zoom / pan / download
//  FIX [2]: all event listeners are named and
//           properly removed on close (no leaks)
// ──────────────────────────────────────────────
function showImageModal(item) {
  const imgSrc  = item.path || '';
  const imgName = item.name || 'Image';

  const mc = document.getElementById('imageModalContainer');
  mc.innerHTML = `
    <div class="img-modal-overlay" id="imgModalOverlay">
      <div class="img-modal-toolbar">
        <div class="img-modal-title">${escHtml(imgName)}</div>
        <div class="img-modal-actions">
          <button class="img-modal-btn" id="imgZoomIn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Zoom In
          </button>
          <button class="img-modal-btn" id="imgZoomOut">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Zoom Out
          </button>
          <button class="img-modal-btn" id="imgZoomReset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.99"/></svg>
            Reset
          </button>
          <button class="img-modal-btn" id="imgDownload" style="border-color:rgba(201,168,76,0.5);color:#E8C96A;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
          <button class="img-modal-close-btn" id="imgModalClose">✕</button>
        </div>
      </div>

      <div class="img-modal-viewport" id="imgViewport">
        <div class="img-modal-inner" id="imgInner">
          <img src="${escHtml(imgSrc)}" alt="${escHtml(imgName)}" class="img-modal-img" id="imgEl" />
        </div>
      </div>

      <div class="img-modal-zoom-hint" id="imgZoomHint">
        Scroll to zoom · Drag to pan · Double-click to fit
      </div>
    </div>`;

  // ── State ──────────────────────────────────────
  let scale = 1, panX = 0, panY = 0;
  let isDragging = false, lastX = 0, lastY = 0;
  const MIN_SCALE = 0.5, MAX_SCALE = 8;

  const overlay  = document.getElementById('imgModalOverlay');
  const viewport = document.getElementById('imgViewport');
  const inner    = document.getElementById('imgInner');

  function applyTransform(smooth = false) {
    inner.style.transition = smooth ? 'transform 0.22s ease' : 'none';
    inner.style.transform  = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function setScale(newScale, ox = 0, oy = 0) {
    const prev = scale;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    const ratio = scale / prev;
    panX = ox + (panX - ox) * ratio;
    panY = oy + (panY - oy) * ratio;
    applyTransform();
  }

  // ── Toolbar buttons ────────────────────────────
  document.getElementById('imgZoomIn').onclick    = () => setScale(scale * 1.35);
  document.getElementById('imgZoomOut').onclick   = () => setScale(scale / 1.35);
  document.getElementById('imgZoomReset').onclick = () => { scale=1; panX=0; panY=0; applyTransform(true); };
  document.getElementById('imgDownload').onclick  = () => triggerDownload(imgSrc);
  document.getElementById('imgModalClose').onclick = closeImageModal;

  overlay.addEventListener('click', _imgOverlayClick);
  function _imgOverlayClick(e) { if (e.target === overlay) closeImageModal(); }

  // ── Double-click to fit / zoom ─────────────────
  document.getElementById('imgEl').addEventListener('dblclick', () => {
    if (scale !== 1) { scale=1; panX=0; panY=0; }
    else { scale = 2.5; }
    applyTransform(true);
  });

  // ── Scroll to zoom ─────────────────────────────
  viewport.addEventListener('wheel', _onWheel, { passive: false });
  function _onWheel(e) {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const ox = e.clientX - rect.left - rect.width  / 2;
    const oy = e.clientY - rect.top  - rect.height / 2;
    setScale(scale * (e.deltaY < 0 ? 1.12 : 1/1.12), ox, oy);
  }

  // ── Mouse drag ─────────────────────────────────
  viewport.addEventListener('mousedown', _onMouseDown);
  function _onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
    viewport.classList.add('grabbing');
    e.preventDefault();
  }

  // Use named functions on window so we can remove them cleanly
  window.addEventListener('mousemove', _onMouseMove);
  window.addEventListener('mouseup',   _onMouseUp);

  function _onMouseMove(e) {
    if (!isDragging) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    applyTransform();
  }
  function _onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove('grabbing');
  }

  // ── Touch ──────────────────────────────────────
  let lastTouchDist = 0, lastTouchX = 0, lastTouchY = 0;

  viewport.addEventListener('touchstart', _onTouchStart, { passive: false });
  viewport.addEventListener('touchmove',  _onTouchMove,  { passive: false });

  function _onTouchStart(e) {
    if (e.touches.length === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
    }
    e.preventDefault();
  }

  function _onTouchMove(e) {
    if (e.touches.length === 1) {
      panX += e.touches[0].clientX - lastTouchX;
      panY += e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
      setScale(scale * (d / lastTouchDist));
      lastTouchDist = d;
    }
    e.preventDefault();
  }

  // ── Escape key ─────────────────────────────────
  document.addEventListener('keydown', _onImgKey);
  function _onImgKey(e) { if (e.key === 'Escape') closeImageModal(); }

  // Hide hint after 3 s
  setTimeout(() => {
    const hint = document.getElementById('imgZoomHint');
    if (hint) hint.style.opacity = '0';
  }, 3000);

  // Store cleanup refs on overlay so closeImageModal can reach them
  overlay._cleanup = () => {
    overlay.removeEventListener('click', _imgOverlayClick);
    viewport.removeEventListener('wheel',      _onWheel);
    viewport.removeEventListener('mousedown',  _onMouseDown);
    viewport.removeEventListener('touchstart', _onTouchStart);
    viewport.removeEventListener('touchmove',  _onTouchMove);
    window.removeEventListener('mousemove', _onMouseMove);
    window.removeEventListener('mouseup',   _onMouseUp);
    document.removeEventListener('keydown', _onImgKey);
  };
}

// FIX [2]: properly call cleanup before clearing HTML
function closeImageModal() {
  const overlay = document.getElementById('imgModalOverlay');
  if (overlay && typeof overlay._cleanup === 'function') overlay._cleanup();
  document.getElementById('imageModalContainer').innerHTML = '';
}

// ──────────────────────────────────────────────
//  EASTER EGG
// ──────────────────────────────────────────────
function showEasterEgg() {
  showModal(`
    <div class="glitch-modal">
      <div style="font-size:3rem;margin-bottom:1rem;animation:rotateCW 3s linear infinite;display:inline-block;">⚙️</div>
      <div class="glitch-text">CLEARANCE: INNER CIRCLE</div>
      <div style="margin:1.5rem 0;font-size:0.8rem;color:#0f0;opacity:0.7;line-height:1.8;">
        WELCOME TO THE INNER CIRCLE ⚙️<br><br>
        You have accessed classified Ministry archives.<br>
        Your loyalty has been noted.<br>
        Your dedication — exemplary.<br><br>
        "The machine does not rest.<br>
        Neither do we."<br><br>
        — High Council, MMA
      </div>
      <div style="font-size:0.65rem;color:#0a0;opacity:0.5;letter-spacing:0.2em;">ACCESS LEVEL: OMEGA-7 GRANTED</div>
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
        <a href="https://instagram.com/mma_official" target="_blank" style="color:#666;transition:color 0.3s;text-decoration:none;display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;" onmouseover="this.style.color='#E1306C'" onmouseout="this.style.color='#666'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          @mma_official
        </a>
        <span style="color:#333;">·</span>
        <a href="tel:+919876543210" style="color:#666;text-decoration:none;font-size:0.85rem;">+91 98765 43210</a>
        <span style="color:#333;">·</span>
        <a href="mailto:mma.ministry@gmail.com" style="color:#666;text-decoration:none;font-size:0.85rem;">mma.ministry@gmail.com</a>
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
//  UTILITY
// ──────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// Expose globals used by inline onclick in home template
window.navigate       = navigate;
window.showMemberModal = showMemberModal;

// ──────────────────────────────────────────────
//  BOOT
// ──────────────────────────────────────────────
(function init() {
  const path = location.pathname;
  updateNavHighlight(path);
  navigate(path, false);
})();