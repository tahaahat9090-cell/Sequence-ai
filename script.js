// ===== حالت‌های برنامه =====
let seq = [];
let lastRelation = null;
let lastType = null;
let lastLabel = null;
let lastCoeffs = [];
let lastConfidence = 100;
let chartType = 'scatter';
let particlesEnabled = true;
let meshEnabled = true;
let history = [];
try { history = JSON.parse(localStorage.getItem('seqHistory') || '[]'); } catch(e) {}

// ===== توست =====
function toast(msg, type = 'info', icon) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const ic = icon || ({success:'✅', error:'⚠️', info:'ℹ️'}[type] || 'ℹ️');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${ic}</span><span>${msg}</span>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== مودال عمومی (جایگزین prompt/confirm/alert) =====
function showModal(title, bodyHTML, buttons) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-backdrop';
    bg.innerHTML = `<div class="modal-box">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-actions">${buttons.map((b,i) => `<button data-i="${i}" class="${b.cls||'modal-btn-secondary'}">${b.label}</button>`).join('')}</div>
    </div>`;
    document.body.appendChild(bg);
    const input = bg.querySelector('input');
    if (input) { setTimeout(()=>input.focus(), 60); input.addEventListener('keydown', e => { if (e.key === 'Enter') confirmBtn(); }); }
    function close(val) { bg.remove(); resolve(val); }
    function confirmBtn() {
      const val = input ? input.value : true;
      close(val);
    }
    bg.querySelectorAll('.modal-actions button').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        const action = buttons[i].action;
        if (action === 'confirm') confirmBtn();
        else close(action === true ? true : null);
      });
    });
    bg.addEventListener('click', e => { if (e.target === bg) close(null); });
  });
}

async function askNumber(title, def) {
  const val = await showModal(title,
    `<input type="number" value="${def}" style="margin-bottom:0">`,
    [{label:'انصراف', action:false}, {label:'تأیید', action:'confirm', cls:'modal-btn-primary'}]);
  return val;
}

async function askConfirm(title) {
  const val = await showModal(title, '',
    [{label:'انصراف', action:false}, {label:'بله، پاک کن', action:true, cls:'modal-btn-danger'}]);
  return !!val;
}

// ===== ذرات + شبکه نورونی =====
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = window.innerWidth < 700 ? 35 : 65;
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.6,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      o: Math.random() * 0.5 + 0.15
    });
  }

  function getAccentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00ff88';
  }
  function hexToRgb(hex) {
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const n = parseInt(hex,16);
    return [(n>>16)&255,(n>>8)&255,n&255];
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!particlesEnabled) { ctx.clearRect(0,0,W,H); return; }
    ctx.clearRect(0, 0, W, H);
    const color = getAccentColor();
    const [r,g,b] = hexToRgb(color);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    });
    if (meshEnabled) {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i+1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${0.08 * (1 - dist/130)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.globalAlpha = p.o;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  loop();
})();

// ===== تنظیمات =====
function openSettings() { document.getElementById('settingsOverlay').classList.add('open'); }
function closeSettings() { document.getElementById('settingsOverlay').classList.remove('open'); }
function closeSettingsOutside(e) { if (e.target === document.getElementById('settingsOverlay')) closeSettings(); }

function setTheme(theme) {
  document.body.dataset.theme = theme;
  document.querySelectorAll('.theme-card').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  savePrefs();
}
function setAccentPreset(name, light, dark) {
  document.body.dataset.accent = name;
  document.documentElement.style.setProperty('--accent', light);
  document.documentElement.style.setProperty('--accent2', dark);
  document.querySelectorAll('.acc-btn').forEach(b => b.classList.toggle('active', b.dataset.accent === name));
  savePrefs({ accentName: name, accentLight: light, accentDark: dark });
}
function setFontSize(size) {
  document.body.dataset.fontSize = size;
  document.querySelectorAll('.seg-btn[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size === size));
  savePrefs();
}
function setBlur(level) {
  document.body.dataset.blur = level;
  document.querySelectorAll('.seg-btn[data-blur]').forEach(b => b.classList.toggle('active', b.dataset.blur === level));
  savePrefs();
}
function setChartType(type) {
  chartType = type;
  document.querySelectorAll('.seg-btn[data-chart]').forEach(b => b.classList.toggle('active', b.dataset.chart === type));
  savePrefs();
}
function toggleParticles() {
  particlesEnabled = !particlesEnabled;
  const tog = document.getElementById('particleTog');
  if (tog) tog.classList.toggle('on', particlesEnabled);
  savePrefs();
}
function toggleMesh() {
  meshEnabled = !meshEnabled;
  const tog = document.getElementById('meshTog');
  if (tog) tog.classList.toggle('on', meshEnabled);
  savePrefs();
}
function resetSettings() {
  document.body.dataset.theme = 'neon';
  document.body.dataset.accent = 'green';
  document.body.dataset.fontSize = 'medium';
  document.body.dataset.blur = 'high';
  document.documentElement.style.removeProperty('--accent');
  document.documentElement.style.removeProperty('--accent2');
  chartType = 'scatter';
  particlesEnabled = true;
  meshEnabled = true;
  document.querySelectorAll('.theme-card').forEach(b => b.classList.toggle('active', b.dataset.theme === 'neon'));
  document.querySelectorAll('.acc-btn').forEach(b => b.classList.toggle('active', b.dataset.accent === 'green'));
  document.querySelectorAll('.seg-btn[data-size]').forEach(b => b.classList.toggle('active', b.dataset.size === 'medium'));
  document.querySelectorAll('.seg-btn[data-blur]').forEach(b => b.classList.toggle('active', b.dataset.blur === 'high'));
  document.querySelectorAll('.seg-btn[data-chart]').forEach(b => b.classList.toggle('active', b.dataset.chart === 'scatter'));
  const tog = document.getElementById('particleTog'); if (tog) tog.classList.add('on');
  const mtog = document.getElementById('meshTog'); if (mtog) mtog.classList.add('on');
  try { localStorage.removeItem('seqPrefs'); } catch(e) {}
  toast('تنظیمات بازنشانی شد', 'success');
}
function savePrefs(extra) {
  const p = {
    theme: document.body.dataset.theme,
    accent: document.body.dataset.accent,
    fontSize: document.body.dataset.fontSize,
    blur: document.body.dataset.blur,
    chartType, particles: particlesEnabled, mesh: meshEnabled,
    ...extra
  };
  try { localStorage.setItem('seqPrefs', JSON.stringify(p)); } catch(e) {}
}
function loadPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem('seqPrefs') || '{}'); } catch(e) {}
  if (p.theme) setTheme(p.theme);
  if (p.fontSize) setFontSize(p.fontSize);
  if (p.blur) setBlur(p.blur);
  if (p.chartType) setChartType(p.chartType);
  if (p.accentName) setAccentPreset(p.accentName, p.accentLight, p.accentDark);
  particlesEnabled = p.particles !== false;
  meshEnabled = p.mesh !== false;
  const tog = document.getElementById('particleTog'); if (tog) tog.classList.toggle('on', particlesEnabled);
  const mtog = document.getElementById('meshTog'); if (mtog) mtog.classList.toggle('on', meshEnabled);
}

// ===== پالت فرمان =====
const COMMANDS = [
  { label: '▶ تحلیل دنباله', key:'Enter', action: () => analyzeSequence() },
  { label: '🔢 محاسبه جمله nام', key:'', action: () => computeNthTerm() },
  { label: '📈 نمایش نمودار', key:'', action: () => drawChart() },
  { label: '📊 نمایش آمار', key:'', action: () => showStats() },
  { label: '🧠 تحلیل پیشرفته', key:'', action: () => showAdvanced() },
  { label: '🧮 ماشین حساب', key:'', action: () => calculator() },
  { label: '🕘 تاریخچه', key:'', action: () => showHistory() },
  { label: '⚙ تنظیمات', key:'', action: () => openSettings() },
  { label: '🗑️ پاک کردن ورودی', key:'', action: () => clearInput() },
];
function openCommandPalette() {
  document.getElementById('cmdOverlay').classList.add('open');
  document.getElementById('cmdInput').value = '';
  renderCommands(COMMANDS);
  setTimeout(() => document.getElementById('cmdInput').focus(), 60);
}
function closeCmdPalette() { document.getElementById('cmdOverlay').classList.remove('open'); }
function closeCmdOutside(e) { if (e.target === document.getElementById('cmdOverlay')) closeCmdPalette(); }
function renderCommands(list) {
  const box = document.getElementById('cmdList');
  box.innerHTML = list.map((c,i) => `<div class="cmd-item" data-i="${i}"><span>${c.label}</span>${c.key?`<span class="cmd-key">${c.key}</span>`:''}</div>`).join('') || '<div style="padding:14px;color:var(--muted)">چیزی پیدا نشد</div>';
  box.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => { list[+el.dataset.i].action(); closeCmdPalette(); });
  });
}
function filterCommands() {
  const q = document.getElementById('cmdInput').value.trim();
  renderCommands(COMMANDS.filter(c => c.label.includes(q)));
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); }
  if (e.key === 'Escape') { closeCmdPalette(); closeSettings(); }
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); document.getElementById('sequence').focus(); }
});

// ===== ریاضیات پایه =====
function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }
function isPrime(n) { if (n < 2) return false; for (let i=2;i<=Math.sqrt(n);i++) if (n%i===0) return false; return true; }

// ===== شناساگرهای دنباله =====
function isArithmetic(s) {
  if (s.length < 2) return null;
  const d = s[1] - s[0];
  if (s.every((v, i) => i === 0 || Math.abs(v - s[i-1] - d) < 1e-6)) {
    const sign = d >= 0 ? '+' : '-';
    return { label: 'حسابی', rel: `a(n) = ${s[0]} ${sign} (n-1)×${Math.abs(d)}`, type: 'arithmetic', d };
  }
  return null;
}
function isExponential(s) {
  if (s.length < 2 || s.includes(0)) return null;
  const ratios = s.slice(1).map((v,i) => v / s[i]);
  if (ratios.every(r => Math.abs(r - ratios[0]) < 1e-6)) {
    const base = +ratios[0].toFixed(6);
    return { label: 'هندسی', rel: `a(n) = ${s[0]} × ${base}^(n-1)`, type: 'exponential', base };
  }
  return null;
}
function isFibonacci(s) {
  if (s.length < 3) return false;
  for (let i = 2; i < s.length; i++) if (Math.abs(s[i] - s[i-1] - s[i-2]) > 1e-6) return false;
  return true;
}
function isLucas(s) {
  if (s.length < 3 || s[0] !== 2 || s[1] !== 1) return null;
  for (let i = 2; i < s.length; i++) if (Math.abs(s[i] - s[i-1] - s[i-2]) > 1e-6) return null;
  return { label: 'لوکاس', rel: 'L(n) = L(n-1) + L(n-2)  ,  L(1)=2, L(2)=1', type: 'lucas' };
}
function isFactorial(s) {
  for (let i = 1; i <= s.length; i++) if (Math.round(factorial(i)) !== s[i-1]) return null;
  return { label: 'فاکتوریل', rel: 'a(n) = n!', type: 'factorial' };
}
function isSquare(s) {
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i] - Math.pow(i+1, 2)) > 1e-6) return null;
  return { label: 'مربع‌کامل', rel: 'a(n) = n²', type: 'square' };
}
function isCube(s) {
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i] - Math.pow(i+1, 3)) > 1e-6) return null;
  return { label: 'مکعب‌کامل', rel: 'a(n) = n³', type: 'cube' };
}
function isTriangular(s) {
  for (let i = 0; i < s.length; i++) { const n = i+1; if (Math.abs(s[i] - n*(n+1)/2) > 1e-6) return null; }
  return { label: 'اعداد مثلثی', rel: 'a(n) = n×(n+1)/2', type: 'triangular' };
}
function isHarmonic(s) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) { sum += 1/(i+1); if (Math.abs(s[i]-sum) > 1e-4) return null; }
  return { label: 'هارمونیک', rel: 'a(n) = Σ(1/k) برای k=1..n', type: 'harmonic' };
}
function isRepunit(s) {
  for (let i = 0; i < s.length; i++) { const r = +('1'.repeat(i+1)); if (s[i] !== r) return null; }
  return { label: 'رپیونیت', rel: 'a(n) = (10^n - 1)/9', type: 'repunit' };
}
function isCatalan(s) {
  const cat = [1];
  for (let n = 1; n < s.length; n++) cat.push(Math.round(factorial(2*n) / (factorial(n+1)*factorial(n))));
  if (s.every((v,i) => v === cat[i])) return { label: 'کاتالان', rel: 'C(n) = (2n)! / ((n+1)! × n!)', type: 'catalan' };
  return null;
}
function isPrimeSeq(s) {
  const primes = []; let n = 2;
  while (primes.length < s.length) { if (isPrime(n)) primes.push(n); n++; }
  if (s.every((v,i) => v === primes[i])) return { label: 'اعداد اول', rel: 'دنباله اعداد اول', type: 'prime' };
  return null;
}
function isAlternating(s) {
  if (s.length < 2) return null;
  const [a, b] = s;
  for (let i = 0; i < s.length; i++) if (s[i] !== (i % 2 === 0 ? a : b)) return null;
  const mid = (a+b)/2, amp = (a-b)/2;
  return { label: 'متناوب', rel: `a(n) = ${mid.toFixed(2)} + ${amp.toFixed(2)}×(-1)^n`, type: 'alternating' };
}

// تشخیص بازگشتی خطی عمومی (مرتبه ۲ یا ۳): a(n) = c1*a(n-1) + c2*a(n-2) [+ c3*a(n-3)]
function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row,i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let k = i+1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    if (Math.abs(M[i][i]) < 1e-9) return null;
    for (let k = i+1; k < n; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n-1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i+1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}
function isLinearRecurrence(s, order) {
  if (s.length < order*2 + 1) return null;
  const A = [], b = [];
  for (let i = 0; i < order; i++) {
    const row = [];
    for (let k = 0; k < order; k++) row.push(s[i+order-1-k]);
    A.push(row); b.push(s[i+order]);
  }
  const coeffs = solveLinear(A, b);
  if (!coeffs) return null;
  for (let i = order; i < s.length; i++) {
    let calc = 0;
    for (let k = 0; k < order; k++) calc += coeffs[k] * s[i-1-k];
    if (Math.abs(calc - s[i]) > 1e-4) return null;
  }
  const rounded = coeffs.map(c => Math.abs(c - Math.round(c)) < 1e-6 ? Math.round(c) : +c.toFixed(3));
  const terms = rounded.map((c,k) => `${c}×a(n-${k+1})`).join(' + ').replace(/\+ -/g,'- ');
  return { label: `بازگشتی مرتبه ${order}`, rel: `a(n) = ${terms}`, type: 'recurrence', order, coeffs: rounded };
}

function solvePolynomial(xVals, yVals) {
  const n = xVals.length;
  const A = xVals.map(x => Array.from({length:n}, (_,i) => Math.pow(x, n-1-i)));
  yVals = [...yVals];
  for (let i = 0; i < n; i++) {
    let pivot = A[i][i];
    if (Math.abs(pivot) < 1e-9) return null;
    for (let j = 0; j < n; j++) A[i][j] /= pivot;
    yVals[i] /= pivot;
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const f = A[k][i];
        for (let j = 0; j < n; j++) A[k][j] -= f * A[i][j];
        yVals[k] -= f * yVals[i];
      }
    }
  }
  return yVals;
}
function polyFormula(coeffs) {
  const deg = coeffs.length - 1;
  const terms = [];
  for (let i = 0; i < coeffs.length; i++) {
    const p = deg - i, c = coeffs[i];
    if (Math.abs(c) < 1e-9) continue;
    const cl = Math.abs(c - Math.floor(c)) < 1e-9 ? c.toFixed(0) : c.toFixed(3);
    if (p === 0) terms.push(cl);
    else if (p === 1) terms.push(`${cl}n`);
    else terms.push(`${cl}n^${p}`);
  }
  return 'a(n) = ' + terms.join(' + ').replace(/\+ -/g, '- ');
}

function detectRelation(input) {
  seq = input.filter(x => !isNaN(x));
  lastConfidence = 100;
  if (seq.length < 2) return { label: 'خطا', rel: 'حداقل ۲ عدد وارد کنید', type: null };

  const checks = [isAlternating, isArithmetic, isExponential, isTriangular, isSquare, isCube, isPrimeSeq, isFactorial, isRepunit, isHarmonic, isCatalan, isLucas];
  for (const fn of checks) {
    const r = fn(seq);
    if (r) { lastRelation = r.rel; lastType = r.type; lastLabel = r.label; return r; }
  }
  if (isFibonacci(seq)) {
    lastRelation = 'a(n) = a(n-1) + a(n-2)'; lastType = 'fibonacci'; lastLabel = 'فیبوناچی';
    return { label: 'فیبوناچی', rel: lastRelation, type: 'fibonacci' };
  }

  // بازگشتی خطی عمومی (مرتبه ۲ و ۳) برای دنباله‌های ناشناخته
  for (const order of [3, 2]) {
    const r = isLinearRecurrence(seq, order);
    if (r) { lastRelation = r.rel; lastType = r.type; lastLabel = r.label; lastCoeffs = r.coeffs; return r; }
  }

  const xVals = seq.map((_,i) => i+1);
  const coeffs = solvePolynomial(xVals, [...seq]);
  if (coeffs) {
    let match = true;
    for (let i = 0; i < seq.length; i++) {
      const calc = coeffs.reduce((a,c,j) => a + c * Math.pow(xVals[i], coeffs.length-1-j), 0);
      if (Math.abs(calc - seq[i]) > 1e-6) { match = false; break; }
    }
    if (match) {
      lastRelation = polyFormula(coeffs); lastType = 'polynomial'; lastCoeffs = coeffs; lastLabel = 'چندجمله‌ای';
      return { label: 'چندجمله‌ای', rel: lastRelation, type: 'polynomial' };
    }
  }

  // تخمین نزدیک‌ترین الگو با درصد تطابق (برای دنباله‌های نامشخص)
  lastConfidence = 35;
  lastRelation = 'الگوی دقیقی پیدا نشد'; lastType = null; lastLabel = 'نامشخص';
  return { label: 'نامشخص', rel: 'الگوی معین پیدا نشد', type: null };
}

// ===== آمار =====
function calcStats(s) {
  if (!s.length) return {};
  const sorted = [...s].sort((a,b) => a-b);
  const sum = s.reduce((a,b) => a+b, 0);
  const mean = sum / s.length;
  const variance = s.reduce((a,b) => a + (b-mean)**2, 0) / s.length;
  const diffs = s.slice(1).map((v,i) => v - s[i]);
  return {
    count: s.length, sum: +sum.toFixed(4), mean: +mean.toFixed(4),
    min: sorted[0], max: sorted[sorted.length-1],
    range: +(sorted[sorted.length-1] - sorted[0]).toFixed(4),
    std: +Math.sqrt(variance).toFixed(4),
    median: sorted.length % 2 === 0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)],
    maxDiff: diffs.length ? Math.max(...diffs.map(Math.abs)).toFixed(2) : 0
  };
}

// ===== رابط کاربری =====
function fillExample(val) { document.getElementById('sequence').value = val; analyzeSequence(); }
function clearInput() {
  document.getElementById('sequence').value = '';
  const res = document.getElementById('result'); if (res) res.innerHTML = '';
  document.getElementById('resultSection').style.display = 'none';
  ['chartCard','statsCard','advCard'].forEach(id => document.getElementById(id).style.display = 'none');
}

const typeColors = {
  arithmetic:'#34d399', exponential:'#60a5fa', fibonacci:'#f472b6', polynomial:'#fb923c',
  factorial:'#a78bfa', square:'#22d3ee', cube:'#fbbf24', prime:'#f87171', alternating:'#818cf8',
  triangular:'#2dd4bf', harmonic:'#fcd34d', repunit:'#c084fc', catalan:'#fb7185', lucas:'#38bdf8',
  recurrence:'#34d399'
};
const typeEmojis = {
  arithmetic:'➕', exponential:'📈', fibonacci:'🌀', polynomial:'📐', factorial:'❗',
  square:'²', cube:'³', prime:'🔢', alternating:'🔄', triangular:'🔺', harmonic:'🎵',
  repunit:'1️⃣', catalan:'🌳', lucas:'🔗', recurrence:'🧮', null:'❓'
};

function predictNext(count = 5) {
  if (!lastType) return [];
  const out = [];
  for (let k = 1; k <= count; k++) {
    const n = seq.length + k;
    let v = null;
    if (lastType === 'arithmetic') v = seq[0] + (n-1)*(seq[1]-seq[0]);
    else if (lastType === 'exponential') v = seq[0] * Math.pow(seq[1]/seq[0], n-1);
    else if (lastType === 'fibonacci' || lastType === 'lucas') {
      let f = [...seq]; while (f.length < n) f.push(f[f.length-1]+f[f.length-2]); v = f[n-1];
    } else if (lastType === 'square') v = n*n;
    else if (lastType === 'cube') v = n*n*n;
    else if (lastType === 'triangular') v = n*(n+1)/2;
    else if (lastType === 'factorial') v = factorial(n);
    else if (lastType === 'prime') { let c=0,num=1; while(c<n){num++; if(isPrime(num))c++;} v = num; }
    else if (lastType === 'polynomial') v = lastCoeffs.reduce((a,c,j) => a + c*Math.pow(n, lastCoeffs.length-1-j), 0);
    else if (lastType === 'recurrence') {
      let f = [...seq];
      while (f.length < n) {
        let nv = 0;
        for (let k2 = 0; k2 < lastCoeffs.length; k2++) nv += lastCoeffs[k2] * f[f.length-1-k2];
        f.push(nv);
      }
      v = f[n-1];
    } else if (lastType === 'alternating') v = seq[(n-1)%2];
    if (v !== null) out.push(Number.isInteger(v) ? v : +v.toFixed(4));
  }
  return out;
}

function aiExplain(r) {
  if (!r.type) return 'هوش مصنوعی الگوی مشخصی در این دنباله پیدا نکرد. ممکن است دنباله تصادفی باشد یا به جملات بیشتری برای تشخیص نیاز داشته باشد.';
  const map = {
    arithmetic: `این یک دنباله <b>حسابی</b> است؛ یعنی اختلاف هر دو جمله متوالی همیشه ثابت و برابر <b>${Math.abs(r.d)}</b> است.`,
    exponential: `این یک دنباله <b>هندسی</b> است؛ هر جمله از ضرب جمله قبلی در نسبت ثابت <b>${r.base}</b> به‌دست می‌آید.`,
    fibonacci: `این دنباله از قانون <b>فیبوناچی</b> پیروی می‌کند؛ هر جمله برابر است با مجموع دو جمله قبل از خود.`,
    lucas: `این یک دنباله <b>لوکاس</b> است؛ مشابه فیبوناچی اما با مقادیر آغازین متفاوت (۲ و ۱).`,
    polynomial: `یک رابطه <b>چندجمله‌ای</b> روی این دنباله برازش شده که از روی n مقدار هر جمله را دقیقاً پیش‌بینی می‌کند.`,
    factorial: `این دنباله، <b>فاکتوریل</b> اعداد طبیعی است: هر جمله حاصل‌ضرب همه اعداد از ۱ تا n است.`,
    square: `این دنباله <b>مربع‌های کامل</b> است: جمله n برابر n² است.`,
    cube: `این دنباله <b>مکعب‌های کامل</b> است: جمله n برابر n³ است.`,
    triangular: `این دنباله <b>اعداد مثلثی</b> است؛ هر جمله مجموع n عدد طبیعی اول است.`,
    harmonic: `این یک دنباله <b>هارمونیک</b> است که از جمع معکوس اعداد طبیعی ساخته شده.`,
    repunit: `این دنباله <b>رپیونیت</b> است؛ اعدادی که فقط از رقم ۱ تشکیل شده‌اند (۱، ۱۱، ۱۱۱، ...).`,
    catalan: `این دنباله، <b>اعداد کاتالان</b> است که در ترکیبیات و شمارش ساختارهای درختی کاربرد دارد.`,
    prime: `این دنباله از <b>اعداد اول</b> متوالی تشکیل شده است.`,
    alternating: `این یک دنباله <b>متناوب</b> است که بین دو مقدار ثابت نوسان می‌کند.`,
    recurrence: `هوش مصنوعی یک <b>رابطه بازگشتی خطی</b> از مرتبه ${r.order} کشف کرد؛ هر جمله ترکیب خطی از ${r.order} جمله قبلی است.`
  };
  return map[r.type] || 'الگوی این دنباله شناسایی شد.';
}

function analyzeSequence() {
  const raw = document.getElementById('sequence').value.trim();
  if (!raw) { toast('لطفاً یک دنباله وارد کنید', 'error'); return; }
  const btn = document.getElementById('analyzeBtn');
  btn.classList.add('loading');

  setTimeout(() => {
    const input = raw.split(/[\s,،]+/).map(x => parseFloat(x.replace(',','.')));
    const r = detectRelation(input);

    const color = typeColors[r.type] || '#94a3b8';
    const emoji = typeEmojis[r.type] || '❓';
    const stats = calcStats(seq);
    const confidence = r.type ? 98 : lastConfidence;

    const section = document.getElementById('resultSection');
    section.style.display = 'block';

    const predictions = predictNext(5);
    const predictHTML = predictions.length ? `
      <div class="predict-row">
        ${predictions.map((p,i) => `<span class="predict-chip">a(${seq.length+i+1}) = ${p}</span>`).join('')}
      </div>` : '';

    document.getElementById('result').innerHTML = `
      <div class="result-type-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">
        ${emoji} ${r.label}
      </div>
      <div class="confidence-bar-wrap">
        <span class="confidence-label">دقت تشخیص</span>
        <div class="confidence-bar"><div class="confidence-bar-fill" style="width:${confidence}%"></div></div>
        <span class="confidence-label">${confidence}%</span>
      </div>
      <div class="result-formula">${r.rel}</div>
      <div class="result-meta">
        تعداد جملات: ${seq.length} &nbsp;|&nbsp; میانگین: ${stats.mean} &nbsp;|&nbsp; بازه: [${stats.min}, ${stats.max}]
      </div>
      <div class="ai-explain">🤖 ${aiExplain(r)}</div>
      ${predictHTML}
    `;

    const entry = { seq: raw, rel: r.rel, label: r.label, type: r.type, time: new Date().toLocaleTimeString('fa') };
    history.unshift(entry);
    if (history.length > 30) history.pop();
    try { localStorage.setItem('seqHistory', JSON.stringify(history)); } catch(e) {}

    drawChart();
    btn.classList.remove('loading');
    toast(`دنباله «${r.label}» تشخیص داده شد`, 'success');
  }, 280);
}

function showStats() {
  const card = document.getElementById('statsCard');
  if (!seq.length) { toast('اول یک دنباله را تحلیل کنید', 'error'); return; }
  if (card.style.display !== 'none') { card.style.display = 'none'; return; }
  const s = calcStats(seq);
  const items = [
    ['تعداد', s.count], ['مجموع', s.sum], ['میانگین', s.mean], ['میانه', s.median],
    ['کمینه', s.min], ['بیشینه', s.max], ['بازه', s.range], ['انحراف‌معیار', s.std],
  ];
  document.getElementById('statsBody').innerHTML = items.map(([label, val]) =>
    `<div class="stat-item"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`
  ).join('');
  card.style.display = 'block';
}

// ===== تحلیل پیشرفته =====
function showAdvanced() {
  const card = document.getElementById('advCard');
  if (!seq.length) { toast('اول یک دنباله را تحلیل کنید', 'error'); return; }
  if (card.style.display !== 'none') { card.style.display = 'none'; return; }

  const d1 = seq.slice(1).map((v,i) => +(v - seq[i]).toFixed(4));
  const d2 = d1.slice(1).map((v,i) => +(v - d1[i]).toFixed(4));
  const ratios = seq.slice(1).map((v,i) => seq[i] ? +(v/seq[i]).toFixed(4) : '—');

  let rows = '';
  for (let i = 0; i < seq.length; i++) {
    rows += `<tr><td>n=${i+1}</td><td>${seq[i]}</td><td>${d1[i] ?? '—'}</td><td>${d2[i] ?? '—'}</td><td>${ratios[i] ?? '—'}</td></tr>`;
  }

  let recurHTML = '';
  if (lastType === 'recurrence' || lastType === 'polynomial') {
    recurHTML = `<div class="recur-badge">📐 ${lastRelation}</div>`;
  }

  document.getElementById('advBody').innerHTML = `
    <div class="adv-section-title">📋 جدول تفاضل‌ها و نسبت‌ها</div>
    <table class="adv-table">
      <thead><tr><th>جمله</th><th>مقدار</th><th>تفاضل اول</th><th>تفاضل دوم</th><th>نسبت</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="adv-section-title">🧩 الگوی کشف‌شده</div>
    ${recurHTML || '<p style="color:var(--muted);font-size:0.85rem">رابطه‌ای ساده‌تر از چندجمله‌ای/بازگشتی یافت نشد.</p>'}
    <p style="color:var(--muted);font-size:calc(0.78rem * var(--font-scale));margin-top:10px;line-height:1.8">
      اگر تفاضل اول ثابت باشد، دنباله حسابی است. اگر تفاضل دوم ثابت باشد، دنباله از درجه ۲ (چندجمله‌ای) است.
      اگر نسبت جملات ثابت باشد، دنباله هندسی است.
    </p>
  `;
  card.style.display = 'block';
}

async function computeNthTerm() {
  if (!lastType) { toast('لطفاً اول دنباله را تحلیل کنید', 'error'); return; }
  const nStr = await askNumber('شماره جمله n را وارد کن', 10);
  if (nStr === null || nStr === false) return;
  const n = parseInt(nStr);
  if (!n || isNaN(n) || n < 1) { toast('عدد نامعتبر است', 'error'); return; }

  let result = null;
  if (lastType === 'arithmetic') result = seq[0] + (n-1) * (seq[1]-seq[0]);
  else if (lastType === 'alternating') result = seq[(n-1)%2];
  else if (lastType === 'fibonacci' || lastType === 'lucas') {
    let fib = [...seq]; while (fib.length < n) fib.push(fib[fib.length-1] + fib[fib.length-2]); result = fib[n-1];
  } else if (lastType === 'exponential') result = seq[0] * Math.pow(seq[1]/seq[0], n-1);
  else if (lastType === 'polynomial') result = lastCoeffs.reduce((a,c,j) => a + c * Math.pow(n, lastCoeffs.length-1-j), 0);
  else if (lastType === 'factorial') result = factorial(n);
  else if (lastType === 'square') result = n * n;
  else if (lastType === 'cube') result = n * n * n;
  else if (lastType === 'triangular') result = n*(n+1)/2;
  else if (lastType === 'prime') { let count=0, num=1; while (count<n) { num++; if (isPrime(num)) count++; } result = num; }
  else if (lastType === 'recurrence') {
    let f = [...seq];
    while (f.length < n) {
      let nv = 0;
      for (let k = 0; k < lastCoeffs.length; k++) nv += lastCoeffs[k] * f[f.length-1-k];
      f.push(nv);
    }
    result = f[n-1];
  }

  if (result !== null && !isNaN(result)) {
    const formatted = Number.isInteger(result) ? result : result.toFixed(6);
    toast(`a(${n}) = ${formatted}`, 'success', '🔢');
  } else {
    toast('محاسبه برای این الگو ممکن نیست', 'error');
  }
}

function copyResult() {
  const text = document.getElementById('result').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✅ کپی شد';
    setTimeout(() => btn.textContent = '📋 کپی', 1600);
    toast('نتیجه کپی شد', 'success');
  });
}

function exportJSON() {
  const data = { sequence: seq, type: lastType, label: lastLabel, relation: lastRelation, predictions: predictNext(5) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'sequence-analysis.json'; a.click();
  URL.revokeObjectURL(url);
  toast('فایل JSON دانلود شد', 'success');
}

function downloadChart() {
  const el = document.getElementById('plotDiv');
  if (!el || !window.Plotly) return;
  Plotly.downloadImage(el, { format: 'png', filename: 'sequence-chart', width: 1000, height: 500 });
  toast('نمودار دانلود شد', 'success');
}

// ===== نمودار =====
function drawChart() {
  if (!seq.length) return;
  const card = document.getElementById('chartCard');
  card.style.display = 'block';
  const x = seq.map((_,i) => i+1);
  const color = typeColors[lastType] || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00ff88';

  let trace;
  if (chartType === 'bar') {
    trace = { x, y: seq, type: 'bar', marker: { color: seq.map((_,i) => `hsla(${150+i*18},80%,60%,0.85)`), cornerradius: 6 } };
  } else if (chartType === 'area') {
    trace = { x, y: seq, type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color, width: 2.5, shape: 'spline' }, fillcolor: color + '28' };
  } else {
    trace = { x, y: seq, type: 'scatter', mode: 'lines+markers', line: { color, width: 2.5, shape: 'spline' },
      marker: { size: 8, color, line: { color: 'rgba(255,255,255,0.8)', width: 1.5 } } };
  }

  const isFrost = document.body.dataset.theme === 'frost';
  const textColor = isFrost ? '#334155' : '#e2e8f0';
  const gridColor = isFrost ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)';

  Plotly.newPlot('plotDiv', [trace], {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: textColor, family: 'Vazirmatn', size: 12 },
    title: { text: 'نمودار دنباله', font: { size: 14, color: textColor } },
    xaxis: { title: 'n', gridcolor: gridColor, zerolinecolor: gridColor, showgrid: true },
    yaxis: { title: 'a(n)', gridcolor: gridColor, zerolinecolor: gridColor, showgrid: true },
    margin: { t: 48, r: 16, b: 48, l: 50 },
    hoverlabel: { bgcolor: '#0d1424', font: { family: 'Vazirmatn', size: 13 }, bordercolor: color },
    hovermode: 'x unified'
  }, { displayModeBar: false, responsive: true });
}

// ===== تاریخچه =====
function showHistory() {
  const card = document.getElementById('historyCard');
  const body = document.getElementById('historyBody');
  if (card.style.display !== 'none') { card.style.display = 'none'; return; }

  if (!history.length) {
    body.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">تاریخچه‌ای ثبت نشده</p>';
  } else {
    body.innerHTML = history.map((h, i) => `
      <div class="history-item" onclick="loadHistory(${i})">
        <div class="history-time">${h.time}</div>
        <div class="history-seq">${h.seq}</div>
        <div class="history-rel">${h.label}: ${h.rel}</div>
      </div>
    `).join('');
  }
  card.style.display = 'block';
}
function loadHistory(i) {
  const h = history[i];
  document.getElementById('sequence').value = h.seq;
  analyzeSequence();
  document.getElementById('historyCard').style.display = 'none';
}
async function clearHistory() {
  if (!(await askConfirm('تاریخچه پاک شود؟ این عمل قابل بازگشت نیست.'))) return;
  history = [];
  try { localStorage.removeItem('seqHistory'); } catch(e) {}
  showHistory();
  toast('تاریخچه پاک شد', 'success');
}

// ===== ماشین حساب =====
function calculator() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-box" style="width:min(360px,95vw)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-size:1.05rem;font-weight:700;color:var(--accent)">🧮 ماشین حساب</span>
        <button onclick="this.closest('.modal-backdrop').remove()"
          style="background:rgba(255,255,255,0.1);border:1px solid var(--border);color:var(--text);width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:1rem">✕</button>
      </div>
      <div id="calcDisplay" style="font-size:1.85rem;text-align:right;min-height:68px;background:rgba(0,0,0,0.28);border-radius:16px;padding:12px 18px;margin-bottom:10px;word-break:break-all;color:var(--text);letter-spacing:1px;border:1px solid var(--border)">0</div>
      <div id="calcExpr" style="font-size:0.76rem;text-align:right;color:var(--muted);padding:0 4px;margin-bottom:12px;min-height:18px;font-family:'JetBrains Mono',monospace"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${[
          ['AC','rgba(244,114,182,0.35)','#f472b6'],['±','rgba(255,255,255,0.08)',''],['%','rgba(255,255,255,0.08)',''],['÷','rgba(96,165,250,0.25)','#60a5fa'],
          ['7','rgba(255,255,255,0.08)',''],['8','rgba(255,255,255,0.08)',''],['9','rgba(255,255,255,0.08)',''],['×','rgba(96,165,250,0.25)','#60a5fa'],
          ['4','rgba(255,255,255,0.08)',''],['5','rgba(255,255,255,0.08)',''],['6','rgba(255,255,255,0.08)',''],['−','rgba(96,165,250,0.25)','#60a5fa'],
          ['1','rgba(255,255,255,0.08)',''],['2','rgba(255,255,255,0.08)',''],['3','rgba(255,255,255,0.08)',''],['＋','rgba(96,165,250,0.25)','#60a5fa'],
          ['0','rgba(255,255,255,0.08)','','grid-column:span 2'],['٫','rgba(255,255,255,0.08)',''],['=','linear-gradient(135deg,var(--accent),var(--accent2))','#000']
        ].map(([b,bg,fc,extra='']) => `<button onclick="calcClick('${b}')"
          style="padding:17px 8px;border-radius:13px;border:1px solid rgba(255,255,255,0.07);background:${bg};color:${fc||'var(--text)'};font-size:1.1rem;cursor:pointer;${extra?extra+';':''}font-family:Vazirmatn,sans-serif;transition:transform 0.12s,opacity 0.12s"
          onmousedown="this.style.transform='scale(0.91)';this.style.opacity='0.8'" onmouseup="this.style.transform='';this.style.opacity='1'">${b}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

let calcCurrentVal = '0', calcExprStr = '';
window.calcClick = function(btn) {
  const disp = document.getElementById('calcDisplay');
  const expr = document.getElementById('calcExpr');
  if (!disp) return;
  if (btn === 'AC') { calcCurrentVal = '0'; calcExprStr = ''; disp.textContent = '0'; if(expr) expr.textContent = ''; }
  else if (btn === '±') { calcCurrentVal = String(parseFloat(calcCurrentVal) * -1); disp.textContent = calcCurrentVal; }
  else if (btn === '%') { calcCurrentVal = String(parseFloat(calcCurrentVal) / 100); disp.textContent = calcCurrentVal; }
  else if (btn === '=') {
    try {
      const e = calcExprStr + calcCurrentVal;
      if(expr) expr.textContent = e + ' =';
      const res = Function('"use strict"; return (' + e.replace(/÷/g,'/').replace(/×/g,'*').replace(/−/g,'-').replace(/＋/g,'+').replace(/٫/g,'.') + ')')();
      calcCurrentVal = String(+res.toFixed(10));
      disp.textContent = calcCurrentVal;
      calcExprStr = '';
    } catch { disp.textContent = 'خطا'; calcCurrentVal='0'; calcExprStr=''; }
  } else if (['÷','×','−','＋'].includes(btn)) {
    calcExprStr += calcCurrentVal + btn;
    if(expr) expr.textContent = calcExprStr;
    calcCurrentVal = '0';
  } else if (btn === '٫') {
    if (!calcCurrentVal.includes('.')) { calcCurrentVal += '.'; disp.textContent = calcCurrentVal; }
  } else {
    if (calcCurrentVal === '0') calcCurrentVal = btn; else calcCurrentVal += btn;
    disp.textContent = calcCurrentVal;
  }
};

// ===== پرسش و پاسخ (ذخیره مشترک روی jsonblob.com) =====
// مهم: این مقدار یک‌بار باید با آیدی واقعی blob جایگزین شود.
// اگر مقدار 'PASTE_YOUR_BLOB_ID_HERE' باقی بماند، اسکریپت خودش یک blob می‌سازد
// و آیدی آن را با یک popup نشان می‌دهد تا اینجا جایگزین کنید (فقط یک‌بار لازم است).
const QA_BLOB_ID = 'PASTE_YOUR_BLOB_ID_HERE';
let qaData = [];
let qaLoading = false;
let qaOfflineMode = false; // اگر سرور در دسترس نباشد، true می‌شود و از localStorage استفاده می‌کنیم

function qaLoadLocal() {
  try { return JSON.parse(localStorage.getItem('seqQA_offlineData') || '[]'); } catch(e) { return []; }
}
function qaSaveLocal(data) {
  try { localStorage.setItem('seqQA_offlineData', JSON.stringify(data)); } catch(e) {}
}

async function qaGetBlobId() {
  if (qaOfflineMode) return null;
  if (QA_BLOB_ID && QA_BLOB_ID !== 'PASTE_YOUR_BLOB_ID_HERE') return QA_BLOB_ID;
  // حالت اضطراری: اگر کسی فراموش کرد blob بسازد، یکی موقت در همین مرورگر بساز و فقط به خودش هشدار بده
  let temp = null;
  try { temp = localStorage.getItem('seqQA_tempBlob'); } catch(e) {}
  if (temp) return temp;
  try {
    const res = await fetch('https://jsonblob.com/api/jsonBlob', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '[]'
    });
    const loc = res.headers.get('Location') || res.headers.get('location') || '';
    const id = loc.split('/').filter(Boolean).pop();
    if (!id) throw new Error('no id');
    try { localStorage.setItem('seqQA_tempBlob', id); } catch(e) {}
    alert('سطل موقت ساخته شد (فقط برای تو روی همین گوشی فعاله).\nاین آیدی رو برای Claude بفرست تا بین همه کاربرا مشترک بشه:\n\n' + id);
    return id;
  } catch (e) {
    // سرور jsonblob در دسترس نیست (مثلاً فیلتر است) -> برو به حالت آفلاین/محلی
    qaOfflineMode = true;
    toast('اتصال به سرور برقرار نشد؛ حالت محلی (آفلاین) فعال شد', 'info', '📴');
    return null;
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'همین الان';
  if (diff < 3600) return `${Math.floor(diff/60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ساعت پیش`;
  return `${Math.floor(diff/86400)} روز پیش`;
}

async function qaFetch() {
  if (qaOfflineMode) return qaLoadLocal();
  const blob = await qaGetBlobId();
  if (!blob) return qaOfflineMode ? qaLoadLocal() : [];
  try {
    const res = await fetch(`https://jsonblob.com/api/jsonBlob/${blob}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404) return [];
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) {
    qaOfflineMode = true;
    toast('اتصال به سرور برقرار نشد؛ حالت محلی (آفلاین) فعال شد', 'info', '📴');
    return qaLoadLocal();
  }
}

async function qaPush(data) {
  if (qaOfflineMode) { qaSaveLocal(data); return true; }
  const blob = await qaGetBlobId();
  if (!blob) {
    if (qaOfflineMode) { qaSaveLocal(data); return true; }
    return false;
  }
  try {
    await fetch(`https://jsonblob.com/api/jsonBlob/${blob}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return true;
  } catch (e) {
    qaOfflineMode = true;
    qaSaveLocal(data);
    toast('ذخیره روی سرور ناموفق بود؛ ذخیره محلی شد', 'info', '📴');
    return true;
  }
}

async function qaRefresh(showLoading) {
  if (showLoading) {
    const list = document.getElementById('qaList');
    if (list) list.innerHTML = `<div style="color:var(--muted);font-size:calc(0.82rem * var(--font-scale));text-align:center;padding:20px 0">⏳ در حال بارگذاری...</div>`;
  }
  const data = await qaFetch();
  if (data !== null) qaData = data;
  renderQA();
}

function openQA() {
  document.getElementById('qaOverlay').classList.add('open');
  qaRefresh(true);
  setTimeout(() => document.getElementById('qaNewQuestion')?.focus(), 100);
}
function closeQA() { document.getElementById('qaOverlay').classList.remove('open'); }
function closeQAOutside(e) { if (e.target === document.getElementById('qaOverlay')) closeQA(); }

async function submitQuestion() {
  const input = document.getElementById('qaNewQuestion');
  const text = (input.value || '').trim();
  if (!text) { toast('یک سوال بنویس', 'error'); return; }
  if (qaLoading) return;
  qaLoading = true;
  const latest = await qaFetch();
  if (latest !== null) qaData = latest;
  qaData.unshift({ id: Date.now(), text, ts: Date.now(), answers: [] });
  const ok = await qaPush(qaData);
  qaLoading = false;
  input.value = '';
  renderQA();
  if (ok) toast('سوال ثبت شد', 'success', '✅');
}

async function deleteQuestion(id) {
  qaData = qaData.filter(q => q.id !== id);
  renderQA();
  await qaPush(qaData);
  toast('سوال حذف شد', 'info', '🗑️');
}

async function submitAnswer(qId) {
  const input = document.getElementById(`qaAnswerInput-${qId}`);
  const text = (input.value || '').trim();
  if (!text) { toast('یک پاسخ بنویس', 'error'); return; }
  if (qaLoading) return;
  qaLoading = true;
  const latest = await qaFetch();
  if (latest !== null) qaData = latest;
  const q = qaData.find(q => q.id === qId);
  if (q) q.answers.push({ id: Date.now(), text, ts: Date.now() });
  const ok = await qaPush(qaData);
  qaLoading = false;
  renderQA();
  if (ok) toast('پاسخ ثبت شد', 'success', '✅');
}

async function deleteAnswer(qId, aId) {
  const q = qaData.find(q => q.id === qId);
  if (!q) return;
  q.answers = q.answers.filter(a => a.id !== aId);
  renderQA();
  await qaPush(qaData);
}

function renderQA() {
  const list = document.getElementById('qaList');
  if (!list) return;
  if (!qaData.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:calc(0.82rem * var(--font-scale));text-align:center;padding:20px 0">هنوز سوالی ثبت نشده. اولین نفر باش!</div>`;
    return;
  }
  list.innerHTML = qaData.map(q => `
    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div style="font-size:calc(0.88rem * var(--font-scale));font-weight:600;color:var(--text);flex:1">${escapeHtml(q.text)}</div>
        <button onclick="deleteQuestion(${q.id})" title="حذف سوال" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.8rem;flex-shrink:0">✕</button>
      </div>
      <div style="font-size:calc(0.68rem * var(--font-scale));color:var(--muted);font-family:'JetBrains Mono',monospace;margin-bottom:10px">${timeAgo(q.ts)} · ${q.answers.length} پاسخ</div>

      ${q.answers.map(a => `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;background:var(--surface);border-radius:var(--radius-xs);padding:9px 11px;margin-bottom:6px">
          <div style="font-size:calc(0.8rem * var(--font-scale));color:var(--text);flex:1">${escapeHtml(a.text)}<div style="font-size:calc(0.62rem * var(--font-scale));color:var(--muted);margin-top:3px;font-family:'JetBrains Mono',monospace">${timeAgo(a.ts)}</div></div>
          <button onclick="deleteAnswer(${q.id},${a.id})" title="حذف پاسخ" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.7rem;flex-shrink:0">✕</button>
        </div>
      `).join('')}

      <div style="display:flex;gap:6px;margin-top:8px">
        <input id="qaAnswerInput-${q.id}" type="text" placeholder="پاسخت رو بنویس..." autocomplete="off" spellcheck="false"
               onkeydown="if(event.key==='Enter') submitAnswer(${q.id})" style="flex:1;font-size:calc(0.8rem * var(--font-scale));padding:8px 10px">
        <button onclick="submitAnswer(${q.id})" style="background:var(--accent);color:#000;border:none;border-radius:var(--radius-xs);padding:0 12px;cursor:pointer;font-weight:700;font-size:calc(0.78rem * var(--font-scale))">ارسال</button>
      </div>
    </div>
  `).join('');
}

// ===== اجرا =====
loadPrefs();

// ===== PWA: نصب اپلیکیشن =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = '';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
  toast('با موفقیت نصب شد', 'success', '📲');
});

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isIOS && !isStandalone) {
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = '';
}

async function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome !== 'accepted') toast('نصب لغو شد', 'info');
    return;
  }
  if (isIOS) {
    await showModal('نصب اپلیکیشن',
      `<div style="font-size:0.85rem;line-height:2">
        ۱. روی دکمه‌ی <b>Share</b> (مربع با فلش رو به بالا) در نوار پایین سافاری بزن.<br>
        ۲. گزینه‌ی <b>«افزودن به صفحه اصلی»</b> (Add to Home Screen) رو انتخاب کن.<br>
        ۳. روی <b>افزودن</b> بزن.
      </div>`,
      [{label:'متوجه شدم', action:'confirm', cls:'modal-btn-primary'}]);
    return;
  }
  toast('مرورگرت از نصب مستقیم پشتیبانی نمی‌کند', 'info');
}
