'use strict';
// Modulation view: sources -> Math -> destinations, drawn as a patch.
// Uses globals from app.js: BY, MAP, state, part, shown, fmt, makeControl, controls, refresh, viewHooks, store, el, $
const DESTS = ['Cutoff', 'Reso', 'Mode', 'Separat', 'Depth', 'Pitch', 'Tune2', 'Detune', 'Balance', 'Noise', 'PW1', 'PW2', 'Charactr', 'Drive', 'Gain', 'Volume', 'Pan',
  'LFO 1 Hz', 'LFO 2 Hz', 'LFO 3 Hz', 'LFO 4 Hz', 'Amp Atk', 'Amp Dec', 'Amp Sus', 'Amp Rel', 'VCF Atk', 'VCF Dec', 'VCF Sus', 'VCF Rel', 'DCO Atk', 'DCO Dec', 'DCO Sus', 'DCO Rel', 'Aux Atk', 'Aux Dec', 'Aux Sus', 'Aux Rel'];
const LFOS = ['LFO 1', 'LFO 2', 'LFO 3', 'LFO 4'], ENVS = ['Amp Env', 'VCF Env', 'DCO Env', 'Aux Env'], MATHS = ['Math 1', 'Math 2', 'Math 3', 'Math 4'];
const BEATS = { '8/1': 32, '4/1': 16, '2/1': 8, '1/1': 4, '1/2': 2, '1/4.': 1.5, '1/2t': 4 / 3, '1/4': 1, '1/8.': .75, '1/4t': 2 / 3, '1/8': .5, '1/16.': .375, '1/8t': 1 / 3, '1/16': .25, '1/32.': .1875, '1/16t': 1 / 6, '1/32': .125, '1/64.': .09375, '1/32t': 1 / 12, '1/64': .0625 };
const TRIG_TO_SRC = { LFO1: 'LFO 1', LFO2: 'LFO 2', LFO3: 'LFO 3', LFO4: 'LFO 4', NoteOn: 'Note On', NoteOnPt: 'Note On (part)', NoteOff: 'Note Off', NteOffPt: 'Note Off (part)' };
const SRC_COLORS = {
  'LFO 1': '#ff5d5d', 'LFO 2': '#ffa23a', 'LFO 3': '#ffe14d', 'LFO 4': '#8be04e',
  'Amp Env': '#4dd6c4', 'VCF Env': '#4db3ff', 'DCO Env': '#7b8cff', 'Aux Env': '#c77dff',
  'Math 1': '#ff6fcf', 'Math 2': '#2ee6a6', 'Math 3': '#ffb38a', 'Math 4': '#b8ecff'
};
const OTHER_COLORS = ['#e6e6e6', '#d9c38f', '#9fd9c4', '#c9a3e0', '#e0a3a3', '#a3c4e0'];
function colorOf(name) {
  if (SRC_COLORS[name]) return SRC_COLORS[name];
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return OTHER_COLORS[h % OTHER_COLORS.length];
}
const val = (sec, name) => { const p = BY[sec][name]; return p.kind === 'enum' ? p.options[shown(p)] : shown(p); };
const routes = () => state.routes[part];
let selected = { kind: 'lfo', name: 'LFO 1' }, animRefs = [];

// ---------- waveforms ----------
const shRand = []; for (let i = 0; i < 64; i++) shRand.push(Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1);
function wave(w, x) {
  x = ((x % 1) + 1) % 1;
  switch (w) {
    case 'Tri': return x < .5 ? 4 * x - 1 : 3 - 4 * x;
    case 'Sqr': return x < .5 ? 1 : -1;
    case 'Sin': return Math.sin(2 * Math.PI * x);
    case 'Saw': return 2 * x - 1;
    case 'RevSaw': return 1 - 2 * x;
    case 'Exp': return 2 * Math.pow(x, 3) - 1;
    case 'RevExp': return 2 * Math.pow(1 - x, 3) - 1;
    case 'Log': return 2 * Math.sqrt(x) - 1;
    case 'RevLog': return 2 * Math.sqrt(1 - x) - 1;
    case 'S&H': return shRand[Math.floor(x * 8)] * 2 - 1;
  }
  return 0;
}
function lfoHz(name) {
  if (val(name, 'Sync') === 'Clock') { const bpm = shown(BY['Clock']['BPM']) / 10 || 120; return bpm / 60 / BEATS[val(name, 'Clock Div')]; }
  return 0.1 * Math.pow(1000, shown(BY[name]['Rate']) / 16383);   // approximate: 10 s to 100 Hz
}
function lfoLabel(name) {
  const sync = val(name, 'Sync');
  if (sync === 'Clock') return `${val(name, 'Clock Div')} clock`;
  const hz = lfoHz(name);
  return '≈' + (hz < 1 ? `${(1 / hz).toFixed(1)} s` : `${hz.toFixed(1)} Hz`) + (sync !== 'None' ? `, reset ${sync}` : '');
}
const wavePath = (w, x0, y0, wd, h) => { let d = ''; for (let i = 0; i <= 80; i++) { const x = i / 80; d += (i ? 'L' : 'M') + (x0 + x * wd).toFixed(1) + ' ' + (y0 + h / 2 - wave(w, x) * h / 2).toFixed(1); } return d; };
function envPath(name, x0, y0, wd, h) {
  const g = n => shown(BY[name][n]) / 16383, a = g('Attack'), d = g('Decay'), s = g('Sustain'), r = g('Release');
  const k = wd / (a + d + r + .35), bot = y0 + h;
  let x = x0; const pts = [[x, bot]]; x += a * k; pts.push([x, y0]); x += d * k; pts.push([x, bot - s * h]); x += .35 * k; pts.push([x, bot - s * h]); x += r * k; pts.push([x, bot]);
  return 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
}
const MATH_ICON = {
  'SLEW': 'M0 30 L10 30 Q22 30 26 6 L40 6',
  'CURVE': 'M0 34 Q30 34 40 2',
  'FOLD & CLIP': 'M0 34 L12 6 L18 14 L24 6 L30 14 L40 34',
  'QUANTIZE': 'M0 34 L8 34 L8 26 L16 26 L16 18 L24 18 L24 10 L32 10 L32 2 L40 2',
  'MULTI-VIA': 'M0 8 L40 20 M0 20 L40 20 M0 32 L40 20',
  'SAMPLE & HOLD': 'M0 24 L8 24 L8 10 L16 10 L16 30 L24 30 L24 16 L32 16 L32 6 L40 6',
  'TRACK & HOLD': 'M0 30 Q8 10 16 20 L28 20 Q34 26 40 8',
  'SWITCH': 'M0 6 L14 6 M0 18 L14 18 M0 30 L14 30 M14 18 L28 10 L40 10',
  'CROSSFADE': 'M0 6 L40 34 M0 34 L40 6'
};

// ---------- layout ----------
const W = 1180, COLS = { src: 20, math: 430, dest: 900 }, SRC_W = 230, MATH_W = 270, DEST_W = 220;
const isInput = n => /^(Source \d|Control|Trigger|Via \d)$/.test(n);
function mathInputs(m) {
  const names = MAP.mathEngineParams[val(m, 'Engine')] || [];
  return names.filter(isInput).map(n => {
    const v = val(m, n);
    const src = n === 'Trigger' ? (TRIG_TO_SRC[v] || null) : (v === 'Off' ? null : v);
    return { name: n, label: n === 'Source 1' && !names.includes('Source 2') ? 'Src' : n, value: v, src };
  });
}
function mathSummary(m) {
  const names = MAP.mathEngineParams[val(m, 'Engine')] || [];
  return names.filter(n => !isInput(n)).map(n => `${n.replace('Src ', '')} ${fmt(BY[m][n], shown(BY[m][n]))}`).join(' · ');
}
function layout() {
  const nodes = {}; let y = 60;
  for (const l of LFOS) { nodes[l] = { kind: 'lfo', name: l, x: COLS.src, y, w: SRC_W, h: 72 }; y += 84; }
  for (const e of ENVS) { nodes[e] = { kind: 'env', name: e, x: COLS.src, y, w: SRC_W, h: 58 }; y += 70; }
  const used = new Set();
  for (const m of MATHS) for (const i of mathInputs(m)) if (i.src) used.add(i.src);
  for (const r of routes()) { used.add(r.src); if (r.via) used.add(r.via); }
  for (const s of used) if (!nodes[s] && !MATHS.includes(s)) { nodes[s] = { kind: 'other', name: s, x: COLS.src, y, w: SRC_W, h: 34 }; y += 44; }
  const srcBottom = y;
  let my = 60;
  // spread the Math boxes down the column: at least 40 apart, more when the sources column is taller
  const mathH = MATHS.map(m => 64 + mathInputs(m).length * 20), gap = Math.max(40, Math.min(90, (srcBottom - 60 - mathH.reduce((a, b) => a + b, 0)) / 3));
  MATHS.forEach((m, k) => { const ins = mathInputs(m), h = mathH[k]; nodes[m] = { kind: 'math', name: m, x: COLS.math, y: my, w: MATH_W, h, ins }; my += h + gap; });
  let dy = 60;
  for (const d of [...new Set(routes().map(r => r.dest))]) { nodes['dest:' + d] = { kind: 'dest', name: d, x: COLS.dest, y: dy, w: DEST_W, h: 40 }; dy += 52; }
  return { nodes, height: Math.max(srcBottom, my, dy + 60) + 20 };
}
const cable = (x1, y1, x2, y2) => { const dx = Math.max(40, Math.abs(x2 - x1) * .45); return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const outPoint = (nodes, s) => { const n = nodes[s]; return n ? [n.x + n.w, n.y + (n.kind === 'math' ? 22 : n.h / 2)] : null; };
const hidden = () => $('modView').classList.contains('hidden');

function render() {
  const host = $('modGraph'); if (!host || hidden()) return;
  const { nodes, height } = layout();
  const scale = document.body.classList.contains('size-s') ? .78 : document.body.classList.contains('size-l') ? 1.2 : 1;
  let svg = `<svg viewBox="0 0 ${W} ${height}" width="${Math.round(W * scale)}" height="${Math.round(height * scale)}" class="graph">`;
  svg += `<text class="colhead" x="${COLS.src}" y="34">SOURCES</text><text class="colhead" x="${COLS.math}" y="34">MATH (inputs set live over MIDI)</text><text class="colhead" x="${COLS.dest}" y="34">DESTINATIONS (set by hand)</text>`;
  for (const m of MATHS) {
    const n = nodes[m];
    n.ins.forEach((inp, i) => { if (!inp.src) return; const o = outPoint(nodes, inp.src); if (o) svg += `<path class="cable live" style="stroke:${colorOf(inp.src)}" d="${cable(o[0], o[1], n.x, n.y + 58 + i * 20)}"/>`; });
  }
  routes().forEach((r, i) => {
    const o = outPoint(nodes, r.src), d = nodes['dest:' + r.dest]; if (!o || !d) return;
    const ty = d.y + d.h / 2;
    const col = colorOf(r.src);
    svg += `<path class="cable dest ${r.done ? 'done' : 'todo'}${r.removing ? ' removing' : ''}" style="stroke:${col}" data-route="${i}" d="${cable(o[0], o[1], d.x, ty)}"/>`;
    svg += `<text class="amt ${r.done ? '' : 'todo'}" style="fill:${col}" x="${d.x - 8}" y="${ty - 7 - 13 * routes().filter((q, k) => k < i && q.dest === r.dest).length}" text-anchor="end">${r.amt > 0 ? '+' : ''}${r.amt}%${r.via ? ' via ' + esc(r.via) : ''}</text>`;
  });
  animRefs = [];
  for (const n of Object.values(nodes)) {
    const sel = selected && selected.name === n.name ? ' sel' : '';
    const nc = n.kind === 'dest' ? '#8a93a3' : colorOf(n.name);
    svg += `<g class="node ${n.kind}${sel}" data-kind="${n.kind}" data-name="${esc(n.name)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8"/>`;
    if (n.kind !== 'dest') svg += `<rect class="stripe" x="${n.x}" y="${n.y + 6}" width="4" height="${n.h - 12}" rx="2" style="fill:${nc}"/><circle class="jack out" cx="${n.x + n.w}" cy="${n.kind === 'math' ? n.y + 22 : n.y + n.h / 2}" r="5" style="fill:${nc};stroke:${nc}"/>`;
    if (n.kind === 'lfo') {
      const w = val(n.name, 'Wave');
      svg += `<text class="nt" x="${n.x + 12}" y="${n.y + 20}">${n.name}</text><text class="ns" x="${n.x + n.w - 12}" y="${n.y + 20}" text-anchor="end">${esc(w)} · ${esc(lfoLabel(n.name))}</text>`;
      svg += `<path class="wave" style="stroke:${nc}" d="${wavePath(w, n.x + 12, n.y + 30, n.w - 24, 32)}"/><line class="phase" id="ph-${n.name.replace(' ', '')}" x1="${n.x + 12}" x2="${n.x + 12}" y1="${n.y + 28}" y2="${n.y + 64}"/>`;
      animRefs.push({ name: n.name, x0: n.x + 12, w: n.w - 24 });
    } else if (n.kind === 'env') {
      const note = { 'Amp Env': 'always on the amp', 'VCF Env': 'cutoff via Env Amt', 'DCO Env': 'paraphonic levels', 'Aux Env': 'free to route' }[n.name];
      svg += `<text class="nt" x="${n.x + 12}" y="${n.y + 22}">${n.name}</text><text class="ns" x="${n.x + 12}" y="${n.y + 42}">${note}</text><path class="wave" style="stroke:${nc}" d="${envPath(n.name, n.x + 128, n.y + 10, n.w - 140, 38)}"/>`;
    } else if (n.kind === 'other') {
      const mm = /^Macro (\d)$/.exec(n.name), mn = mm && state.macroNames[mm[1] - 1];
      svg += `<text class="nt" x="${n.x + 12}" y="${n.y + 22}">${esc(n.name)}${mn ? `<tspan class="ns"> · ${esc(mn)}</tspan>` : ''}</text>`;
    } else if (n.kind === 'math') {
      const eng = val(n.name, 'Engine');
      svg += `<text class="nt" x="${n.x + 12}" y="${n.y + 20}">${n.name}</text><text class="ns" x="${n.x + 76}" y="${n.y + 20}">${esc(eng)}</text>`;
      svg += `<g transform="translate(${n.x + n.w - 52} ${n.y + 8}) scale(.85)"><rect class="iconbg" x="-4" y="-2" width="48" height="40" rx="4"/><path class="icon" style="stroke:${nc}" d="${MATH_ICON[eng] || ''}"/></g>`;
      svg += `<text class="ns small" x="${n.x + 12}" y="${n.y + 40}">${esc(mathSummary(n.name).slice(0, 44))}</text>`;
      n.ins.forEach((inp, i) => { const jy = n.y + 58 + i * 20; svg += `<circle class="jack ${inp.src ? 'on' : ''}" cx="${n.x}" cy="${jy}" r="5"${inp.src ? ` style="fill:${colorOf(inp.src)};stroke:${colorOf(inp.src)}"` : ''}/><text class="jl" x="${n.x + 12}" y="${jy + 4}">${esc(inp.label)}: ${esc(inp.value)}</text>`; });
    } else if (n.kind === 'dest') {
      svg += `<circle class="jack on" cx="${n.x}" cy="${n.y + n.h / 2}" r="5"/><text class="nt" x="${n.x + 14}" y="${n.y + 25}">${esc(n.name)}</text>`;
    }
    svg += '</g>';
  }
  if (!routes().length) svg += `<text class="hint" x="${COLS.dest}" y="80">No routings yet.</text><text class="hint" x="${COLS.dest}" y="100">Add one in the panel on the right.</text>`;
  host.innerHTML = svg + '</svg>';
  host.querySelectorAll('.node').forEach(g => g.addEventListener('click', () => { selected = { kind: g.dataset.kind, name: g.dataset.name }; render(); editor(); }));
  host.querySelectorAll('.cable.dest').forEach(c => c.addEventListener('click', () => { selected = { kind: 'route', index: Number(c.dataset.route) }; editor(); }));
}
function animate(t) {
  if (!hidden()) for (const a of animRefs) {
    const e = document.getElementById('ph-' + a.name.replace(' ', '')); if (!e) continue;
    const hz = lfoHz(a.name), ph = shown(BY[a.name]['Phase']) / 16383;
    const x = hz > 12 ? a.x0 + a.w / 2 : a.x0 + (((t / 1000) * hz + ph) % 1) * a.w;
    e.setAttribute('x1', x.toFixed(1)); e.setAttribute('x2', x.toFixed(1)); e.classList.toggle('blur', hz > 12);
  }
  requestAnimationFrame(animate);
}

// ---------- gestures for hand-patching ----------
function srcButton(s) {
  if (/^LFO \d$/.test(s)) return `[${s}]`;
  return { 'DCO Env': '[DCO ENV]', 'VCF Env': '[VCF ENV]', 'Amp Env': '[AMP ENV]', 'Aux Env': '[AUX ENV]', Vel: '[VEL]', Key: '[KEY]', AT: '[AT]', ModWheel: '[WHEEL]', Gate: '[GATE]', CC74: '[MIDI]', 'Macro 1': '[MACRO]', VoiceIdx: '[VOICE]', ArpSeq: '[ARP|SEQ]' }[s] || null;
}
function destGesture(d) {
  const knob = { Cutoff: '[CUTOFF]', Reso: '[RESONANCE]', Mode: '[MODE]', Detune: '[DETUNE]', Balance: '[BALANCE]', Charactr: '[CHARACTER]', Drive: '[DRIVE]' }[d];
  if (knob) return `turn ${knob}`;
  const page = { Pitch: ['[PERFORM]', 'Pitch'], Pan: ['[AMP]', 'Pan'], Gain: ['[AMP]', 'Gain'], Volume: ['[AMP]', 'Volume'], Tune2: ['[DCO]', 'Tune2'], Noise: ['[DCO]', 'Noise'], PW1: ['[DCO]', 'PW 1'], PW2: ['[DCO]', 'PW 2'], Separat: ['[VCF]', 'Sep'], Depth: ['[VCF]', 'Depth'] }[d];
  if (page) return `press ${page[0]}, turn ‹${page[1]}›`;
  let m = d.match(/^LFO (\d) Hz$/); if (m) return `press [LFO ${m[1]}], turn ‹Rate›`;
  m = d.match(/^(Amp|VCF|DCO|Aux) (Atk|Dec|Sus|Rel)$/); if (m) return `press [${m[1].toUpperCase()} ENV], turn ‹${m[2]}›`;
  return null;
}
function gesture(r) {
  if (r.removing) return `In [MOD MATRIX], select the ${r.src} → ${r.dest} slot and clear it (set Amount to 0)`;
  if (r.prev) {
    const p = r.prev, f = x => `${x > 0 ? '+' : ''}${x}%`, ch = [];
    if (p.src !== r.src) ch.push(`Source to ${r.src}`);
    if (p.dest !== r.dest) ch.push(`Dest to ${r.dest}`);
    if (p.amt !== r.amt) ch.push(`Amount to ${f(r.amt)}`);
    if ((p.via || null) !== (r.via || null)) ch.push(r.via ? `Via to ${r.via}` : 'Via to Off');
    if (r.via && (p.viaAmt !== r.viaAmt || (p.via || null) !== r.via)) ch.push(`Via Amt to ${r.viaAmt}%`);
    return `In [MOD MATRIX], select the ${p.src} → ${p.dest} slot and set ${ch.length ? ch.join(', ') : 'it as before'}`;
  }
  const amt = `${r.amt > 0 ? '+' : ''}${r.amt}%`, a = srcButton(r.src), v = r.via ? srcButton(r.via) : '', d = destGesture(r.dest);
  if (a && d && (!r.via || v)) return `Hold ${a}${r.via ? ' + ' + v : ''}, ${d} to ${amt}` + (r.via ? `, then set Via Amt to ${r.viaAmt}% in [MOD MATRIX]` : '');
  return `In [MOD MATRIX], add a slot: ${r.src} → ${r.dest}, Amount ${amt}` + (r.via ? `, Via ${r.via} at ${r.viaAmt}%` : '');
}

// ---------- small stand-alone knob (for the Add routing form) ----------
function localKnob(label, min, max, bipolar) {
  let v = 0;
  const wrap = el('div', 'ctl lk'); wrap.appendChild(el('div', 'name', label));
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 48 48'); svg.classList.add('knob');
  const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
  mk('path', { class: 'track', d: arcPath(A0, A0 + SPAN, 21) });
  const arc = mk('path', { class: 'arc' }); mk('circle', { class: 'body', cx: 24, cy: 24, r: 15 });
  const ind = mk('line', { class: 'ind', x1: 24, y1: 24, x2: 24, y2: 12 });
  const out = el('div', 'val');
  wrap.append(svg, out);
  const draw = () => {
    const f = (v - min) / (max - min), a = A0 + f * SPAN, from = bipolar ? A0 + SPAN / 2 : A0;
    arc.setAttribute('d', Math.abs(a - from) < 0.01 ? '' : arcPath(Math.min(from, a), Math.max(from, a), 21));
    ind.setAttribute('x2', 24 + 11 * Math.cos(a)); ind.setAttribute('y2', 24 + 11 * Math.sin(a));
    out.textContent = (bipolar && v > 0 ? '+' : '') + v + '%';
  };
  const set = x => { v = Math.max(min, Math.min(max, Math.round(x))); draw(); };
  let sy = 0, sv = 0;
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); sy = e.clientY; sv = v; });
  svg.addEventListener('pointermove', e => { if (svg.hasPointerCapture(e.pointerId)) set(sv + (sy - e.clientY) * (e.shiftKey ? 0.1 : 0.6)); });
  svg.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * (e.shiftKey ? 1 : 5)); }, { passive: false });
  svg.addEventListener('dblclick', () => set(0));
  draw();
  return { node: wrap, get: () => v };
}

// ---------- horizontal amount slider (for the Add routing form) ----------
function localSlider(label, min, max, bipolar, onChange) {
  let v = 0;
  const wrap = el('div', 'ls');
  const head = el('div', 'ls-head'); head.appendChild(el('span', 'ls-label', label)); const out = el('span', 'ls-val'); head.appendChild(out);
  const track = el('div', 'ls-track'), fill = el('div', 'ls-fill'), thumb = el('div', 'ls-thumb');
  if (bipolar) track.appendChild(el('div', 'ls-zero'));
  track.append(fill, thumb);
  const ends = el('div', 'ls-ends'); ends.append(el('span', null, (bipolar ? '' : '') + min + '%'), el('span', null, (max > 0 ? '+' : '') + max + '%'));
  wrap.append(head, track, ends);
  const pos = x => (x - min) / (max - min) * 100;
  const draw = () => {
    const p = pos(v), z = bipolar ? pos(0) : 0;
    fill.style.left = Math.min(p, z) + '%'; fill.style.width = Math.abs(p - z) + '%'; thumb.style.left = p + '%';
    out.textContent = (bipolar && v > 0 ? '+' : '') + v + '%';
    wrap.classList.toggle('zero', v === 0);
    if (onChange) onChange(v);
  };
  const set = x => { v = Math.max(min, Math.min(max, Math.round(x))); draw(); };
  const fromEvent = e => { const r = track.getBoundingClientRect(); set(min + (e.clientX - r.left) / r.width * (max - min)); };
  track.addEventListener('pointerdown', e => { track.setPointerCapture(e.pointerId); fromEvent(e); });
  track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) fromEvent(e); });
  track.addEventListener('dblclick', () => set(0));
  track.addEventListener('wheel', e => { e.preventDefault(); set(v - Math.sign(e.deltaY) * (e.shiftKey ? 1 : 5)); }, { passive: false });
  draw();
  return { node: wrap, get: () => v, set };
}

// ---------- routing changes (all by hand on the Redshift) ----------
function needsSave() { state.needsSave ||= [false, false, false, false, false, false]; state.needsSave[part] = true; }
function markDone(r) {
  const list = routes();
  if (r.removing) list.splice(list.indexOf(r), 1);
  else { r.done = true; delete r.prev; }
  needsSave();
}
function markUndone(r) { r.done = false; }
function editRoute(r, v) {
  if (r.done && !r.prev) r.prev = { src: r.src, dest: r.dest, amt: r.amt, via: r.via, viaAmt: r.viaAmt };   // it exists on the Redshift: remember what to change
  Object.assign(r, v); delete r.removing;
  if (r.prev && r.prev.src === r.src && r.prev.dest === r.dest && r.prev.amt === r.amt && (r.prev.via || null) === (r.via || null) && r.prev.viaAmt === r.viaAmt) { delete r.prev; r.done = true; }   // changed back: nothing to do
  else r.done = false;
}
function cancelRoute(r) {
  const list = routes();
  if (r.removing) { delete r.removing; r.done = true; }                         // keep it after all
  else if (r.prev) { Object.assign(r, r.prev); delete r.prev; r.done = true; }  // back to what's on the Redshift
  else list.splice(list.indexOf(r), 1);                                          // never made: drop it
}
function cancelGroup() {
  state.groupPrev ||= ['Off', 'Off', 'Off', 'Off', 'Off', 'Off'];
  state.groups[part] = state.groupPrev[part]; state.groupDone[part] = true;
  if (typeof paintGroupBadges === 'function') paintGroupBadges();
}
function removeRoute(r) {
  const list = routes();
  if (r.done || r.prev) { if (r.prev) Object.assign(r, r.prev); delete r.prev; r.removing = true; r.done = false; }   // on the Redshift: becomes a by-hand step
  else list.splice(list.indexOf(r), 1);                                                                             // never made: just drop it
}

// ---------- side editor ----------
function prune() { for (let i = controls.length - 1; i >= 0; i--) if (controls[i].node && !controls[i].node.isConnected) controls.splice(i, 1); }
function controlsBox(sec, names) { const box = el('div', 'controls'); for (const n of names) box.appendChild(makeControl(BY[sec][n])); return box; }
function editor() {
  const ed = $('modEditor'); if (!ed) return; ed.innerHTML = ''; prune();
  const s = selected || {};
  if (s.kind === 'lfo' || s.kind === 'env') {
    ed.appendChild(el('h3', null, s.name)); ed.appendChild(controlsBox(s.name, Object.keys(BY[s.name])));
  } else if (s.kind === 'math') {
    ed.appendChild(el('h3', null, s.name));
    const box = controlsBox(s.name, ['Engine', ...(MAP.mathEngineParams[val(s.name, 'Engine')] || [])]); ed.appendChild(box);
    box.querySelector('select').addEventListener('change', () => requestAnimationFrame(editor));
    ed.appendChild(el('p', 'help', 'What feeds a Math slot is set over MIDI, so these cables are live. Sending its output to a destination is done by hand: add a routing below.'));
  } else if (s.kind === 'route') {
    const r = routes()[s.index];
    if (r) {
      ed.appendChild(el('h3', null, `${r.src} → ${r.dest}`));
      if (r.done) ed.appendChild(el('p', 'help', 'Done by hand. Change it below and the app will tell you what to adjust on the Redshift.'));
      else { ed.appendChild(el('p', 'help', r.removing ? 'To remove by hand on the Redshift:' : 'To do by hand on the Redshift:')); ed.appendChild(el('p', 'gesture', gesture(r)));
        const cx = el('button', 'rf-remove', r.removing ? 'Cancel: keep this routing' : r.prev ? 'Cancel: undo this change' : 'Cancel: don\'t add it'); cx.addEventListener('click', () => { cancelRoute(r); selected = null; save(); }); ed.appendChild(cx); }
      if (r.why) ed.appendChild(el('p', 'help', r.why));
      if (!r.removing) { const box = el('div', 'editbox'); box.appendChild(el('div', 'editbox-title', 'Edit this routing')); box.appendChild(routeForm(r)); ed.appendChild(box); }
    }
  } else if (s.name) ed.appendChild(el('h3', null, s.name));
  ed.appendChild(el('h3', 'sep', `Routings set by hand on Part ${part + 1}`));
  const list = el('div', 'routes');
  routes().forEach((r, i) => {
    const row = el('div', 'route' + (r.done ? ' done' : '') + (r.removing ? ' removing' : '') + (selected && selected.kind === 'route' && selected.index === i ? ' sel' : ''));
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!r.done; cb.title = 'Tick when done by hand on the Redshift';
    cb.addEventListener('change', () => { if (cb.checked) markDone(r); else markUndone(r); save(); });
    const txt = el('div', 'rt'); txt.title = 'Click to edit'; txt.addEventListener('click', () => { selected = { kind: 'route', index: i }; editor(); }); txt.appendChild(el('b', null, `${r.removing ? 'Remove: ' : ''}${r.src} → ${r.dest}  ${r.amt > 0 ? '+' : ''}${r.amt}%${r.via ? ' via ' + r.via : ''}`)); txt.appendChild(el('div', 'g', gesture(r)));
    const del = el('button', 'del', '✕'); del.title = r.done ? 'Remove (adds a by-hand step to clear it on the Redshift)' : 'Remove';
    if (r.removing) del.style.visibility = 'hidden';
    del.addEventListener('click', () => { removeRoute(r); selected = null; save(); });
    row.append(cb, txt, del); list.appendChild(row);
  });
  if (!routes().length) list.appendChild(el('p', 'help', 'None yet.'));
  ed.appendChild(list);
  ed.appendChild(el('h3', 'sep', 'Add a routing')); ed.appendChild(routeForm(null, s.name));
}
function routeForm(r, srcDefault) {
  const mk = (opts, v) => { const x = el('select'); opts.forEach(o => { const op = el('option', null, o); op.value = o; x.appendChild(op); }); if (v && opts.includes(v)) x.value = v; return x; };
  const srcOpts = BY['Math 1']['Source 1'].options.filter(o => o !== 'Off');
  const fSrc = mk(srcOpts, r ? r.src : (srcOpts.includes(srcDefault) ? srcDefault : 'LFO 1')), fDest = mk(DESTS, r ? r.dest : 'Cutoff'), fVia = mk(['none', ...srcOpts], r && r.via ? r.via : 'none');
  const preview = el('div', 'rf-preview');
  const chipA = el('span', 'rf-chip'), wire = el('span', 'rf-wire'), wireAmt = el('span', 'rf-amt'), chipB = el('span', 'rf-chip dest');
  wire.appendChild(wireAmt); preview.append(chipA, wire, chipB);
  const viaRow = el('div', 'rf-via');
  let kAmt = null, kVia = null;
  const go = el('button', 'rf-add', r ? 'Update routing' : 'Add routing');
  const paint = () => {
    const col = colorOf(fSrc.value);
    chipA.textContent = fSrc.value; chipA.style.borderColor = col; chipA.style.color = col;
    wire.style.background = col; chipB.textContent = fDest.value;
    const a = kAmt ? kAmt.get() : 0; wireAmt.textContent = (a > 0 ? '+' : '') + a + '%'; wireAmt.style.color = col;
    const hasVia = fVia.value !== 'none'; viaRow.classList.toggle('off', !hasVia);
    wireAmt.textContent += hasVia ? `  via ${fVia.value} ${kVia ? kVia.get() : 0}%` : '';
    go.disabled = a === 0; go.title = a === 0 ? 'Set an amount first' : '';
  };
  kAmt = localSlider('Amount', -100, 100, true, paint);
  kVia = localSlider('Via amount', 0, 100, false, paint);
  if (r) { kAmt.set(r.amt); kVia.set(r.viaAmt || 0); }
  [fSrc, fDest, fVia].forEach(x => x.addEventListener('change', paint));
  go.addEventListener('click', () => {
    const v = { src: fSrc.value, dest: fDest.value, amt: kAmt.get(), via: fVia.value === 'none' ? null : fVia.value, viaAmt: fVia.value === 'none' ? 0 : kVia.get() };
    if (r) { editRoute(r, v); selected = { kind: 'route', index: routes().indexOf(r) }; }
    else { routes().push(Object.assign(v, { done: false })); selected = { kind: 'route', index: routes().length - 1 }; }
    save();
  });
  const row = (label, ...nodes) => { const x = el('div', 'rf-row'); x.appendChild(el('span', 'rf-lab', label)); nodes.forEach(n => x.appendChild(n)); return x; };
  const form = el('div', 'rf');
  viaRow.append(row('Via', fVia), kVia.node);
  form.append(row('From', fSrc), row('To', fDest), kAmt.node, viaRow, preview, go);
  if (r) {
    const rm = el('button', 'rf-remove', 'Remove routing');
    rm.addEventListener('click', () => { removeRoute(r); selected = null; save(); });
    form.appendChild(rm);
  }
  paint();
  return form;
}
function save() { store.set('state', state); render(); editor(); updateTodo(); }

// ---------- view switching ----------
function showView(v) {
  $('main').classList.toggle('hidden', v !== 'panel');
  $('modView').classList.toggle('hidden', v !== 'mod');
  $('viewPanel').classList.toggle('on', v === 'panel'); $('viewMod').classList.toggle('on', v === 'mod');
  store.set('view', v);
  // keyboard sits under the patch on the Modulation page, in its own section on the Panel page
  const kb = $('kbSection');
  if (v === 'mod') { $('kbSlot').appendChild(kb); kb.classList.add('kb-compact'); $('kbHome').classList.add('hidden'); }
  else { $('kbHome').appendChild(kb); kb.classList.remove('kb-compact'); $('kbHome').classList.remove('hidden'); }
  if (v === 'mod') { render(); editor(); }
  else if (typeof scheduleFit === 'function') scheduleFit();
}
let pendingRender = false;
viewHooks.push(() => { if (pendingRender) return; pendingRender = true; requestAnimationFrame(() => { pendingRender = false; render(); }); });
function setupModView() {
  $('viewPanel').addEventListener('click', () => showView('panel'));
  $('viewMod').addEventListener('click', () => showView('mod'));
  document.querySelectorAll('#parts .hex').forEach(b => b.addEventListener('click', () => { if (!hidden()) editor(); }));
  requestAnimationFrame(animate);
  showView(store.get('view', 'panel'));
  buildTodo();
}

// ---------- floating "To do on the Redshift" window ----------
let todoMin = store.get('todoMin', false), todoPos = store.get('todoPos', null), lastPendingKey = '';
function buildTodo() {
  const w = el('div', 'todo'); w.id = 'todo';
  w.innerHTML = '<div class="todo-head" id="todoHead"><span class="todo-icon">!</span><span id="todoTitle"></span><span class="todo-spacer"></span><button id="todoMin" title="Minimise">–</button></div><div class="todo-body" id="todoBody"></div>';
  document.body.appendChild(w);
  if (todoPos) { w.style.left = todoPos.x + 'px'; w.style.top = todoPos.y + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto'; }
  $('todoMin').addEventListener('click', e => { e.stopPropagation(); todoMin = !todoMin; store.set('todoMin', todoMin); updateTodo(); });
  // drag by the title bar
  const head = $('todoHead'); let sx, sy, ox, oy, moved = false;
  head.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON') return; const r = w.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; moved = false; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => {
    if (!head.hasPointerCapture(e.pointerId)) return;
    const x = Math.max(0, Math.min(innerWidth - 80, ox + e.clientX - sx)), y = Math.max(0, Math.min(innerHeight - 40, oy + e.clientY - sy));
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
    Object.assign(w.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' }); todoPos = { x, y };
  });
  head.addEventListener('pointerup', () => { if (moved) store.set('todoPos', todoPos); else if (todoMin) { todoMin = false; store.set('todoMin', false); updateTodo(); } });
  viewHooks.push(updateTodo);
  updateTodo();
}
function updateTodo() {
  const w = $('todo'); if (!w) return;
  state.needsSave ||= [false, false, false, false, false, false];
  const rs = routes(), pending = rs.filter(r => !r.done);
  const groupTodo = !state.groupDone[part];
  const nTodo = pending.length + (groupTodo ? 1 : 0), saveTodo = !nTodo && state.needsSave[part];
  const others = state.routes.map((list, i) => [i, list.filter(r => !r.done).length + (state.groupDone[i] ? 0 : 1)]).filter(([i, n]) => i !== part && n);
  const key = part + ':' + (groupTodo ? 'g' + state.groups[part] : '') + pending.map(r => r.src + r.dest + r.amt + (r.removing ? 'x' : '')).join('|');
  if (key !== lastPendingKey && nTodo) { todoMin = false; w.classList.remove('pulse'); void w.offsetWidth; w.classList.add('pulse'); }
  lastPendingKey = key;
  w.classList.toggle('hidden', !nTodo && !saveTodo && !others.length);
  w.classList.toggle('clear', !nTodo);
  w.classList.toggle('min', todoMin);
  $('todoTitle').textContent = nTodo ? `${nTodo} step${nTodo > 1 ? 's' : ''} to do by hand · Part ${part + 1}` : saveTodo ? `Part ${part + 1}: done, now save it` : `Nothing to do on Part ${part + 1}`;
  const body = $('todoBody'); body.innerHTML = '';
  const after = () => { store.set('state', state); refresh(); if (!hidden()) { render(); editor(); } updateTodo(); };
  const item = (step, why, onTick, onCancel, cancelLabel = 'Cancel') => {
    const card = el('label', 'todo-item'), cb = el('input'); cb.type = 'checkbox';
    cb.addEventListener('change', () => { onTick(); after(); });
    const txt = el('div'); txt.appendChild(el('div', 'todo-step', step)); if (why) txt.appendChild(el('div', 'todo-why', why));
    card.append(cb, txt);
    if (onCancel) {
      const x = el('button', 'todo-cancel', cancelLabel); x.title = 'Undo this change in the app instead of doing it on the Redshift';
      x.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onCancel(); after(); });
      card.appendChild(x);
    }
    body.appendChild(card);
  };
  if (nTodo) {
    body.appendChild(el('div', 'todo-lead', `Select Part ${part + 1} on the Redshift, then:`));
    let k = 0;
    if (groupTodo) item(`${++k}. Press [PARTS], turn ‹Group› to ${state.groups[part]}`,
      state.groups[part] === 'Off' ? 'take this part out of its group' : `so Part ${part + 1} plays from the Group ${state.groups[part]} channel`,
      () => { state.groupDone[part] = true; state.needsSave[part] = true; }, cancelGroup);
    pending.forEach(r => item(`${++k}. ${gesture(r)}`,
      `${r.removing ? 'remove ' : r.prev ? 'change ' : ''}${r.src} → ${r.dest}${r.why && !r.removing ? ' · ' + r.why : ''}`,
      () => markDone(r), () => cancelRoute(r)));
    body.appendChild(el('div', 'todo-foot', 'Tick each one when you\'ve done it by hand. Until then the sound you hear is missing that part.'));
  } else if (saveTodo) {
    body.appendChild(el('div', 'todo-lead', 'Everything by hand is done. Last step:'));
    item('Press [SHIFT] + [OK] on the Redshift to save the preset', 'so the by-hand changes are kept', () => { state.needsSave[part] = false; }, () => { state.needsSave[part] = false; }, 'Skip');
  }
  if (others.length) body.appendChild(el('div', 'todo-others', 'Also waiting: ' + others.map(([i, n]) => `Part ${i + 1} (${n})`).join(', ')));
}
