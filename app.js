'use strict';
// ---------- storage (per-browser, optional) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('rs6.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('rs6.' + k, JSON.stringify(v)); } catch {} }
};
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let MAP, PARAMS = [], BY = {};            // BY[section][name] = param
let settings = Object.assign({ perform: 1, parts: [2, 3, 4, 5, 6, 7], groups: [8, 9, 10], spacing: 4 }, store.get('settings', {}));
let playTarget = store.get('playTarget', 'part');   // 'part' | 'perform' | 'A' | 'B' | 'C'
let state = store.get('state', { parts: [{}, {}, {}, {}, {}, {}], global: {} });
state.routes ||= [[], [], [], [], [], []];
state.macroNames ||= ['', '', '', '', '', '', '', ''];
state.groups ||= ['Off', 'Off', 'Off', 'Off', 'Off', 'Off'];      // set by hand on the Redshift ([PARTS] > Group)
state.groupDone ||= [true, true, true, true, true, true];
const viewHooks = [];   // other views re-render on change
let verified = store.get('verify', {});
let part = 0;
const controls = [];                      // {p, update}
const visRules = [];                      // functions re-run on change

// ---------- MIDI ----------
let access = null, out = null;
const lastAddr = {};
function status(msg, cls) { $('midiStatus').textContent = msg; $('midiStatus').className = cls || ''; }
function raw(bytes) { if (out) out.send(bytes); }
function cc(chan, num, val) { raw([0xB0 | (chan - 1), num, val & 0x7F]); }
function nrpn(chan, msb, lsb, value) {
  const now = performance.now(), a = lastAddr[chan];
  cc(chan, 99, msb); cc(chan, 98, lsb);   // always send the full address so other apps on the same port can't misdirect values
  cc(chan, 6, (value >> 7) & 0x7F); cc(chan, 38, value & 0x7F);
  lastAddr[chan] = { msb, lsb, t: now };
}
const chanFor = p => p.scope === 'global' ? settings.perform : settings.parts[part];
const playChan = () => playTarget === 'perform' ? settings.perform : ['A', 'B', 'C'].includes(playTarget) ? settings.groups['ABC'.indexOf(playTarget)] : settings.parts[part];
function playLabel() { return playTarget === 'perform' ? `Perform channel (${settings.perform}), plays the part selected on the Redshift` : ['A', 'B', 'C'].includes(playTarget) ? `Group ${playTarget} (channel ${playChan()}), plays every part in that group` : `Part ${part + 1} (channel ${settings.parts[part]})`; }

// ---------- MIDI input (play the Redshift from a hardware keyboard through the app) ----------
let inPort = null;
const inNotes = new Map();   // incoming note -> channel it was sent on, so note-offs follow even if the target changes
function fillInputs() {
  const sel = $('midiIn'); if (!sel || !access) return;
  const want = store.get('midiInName', '');
  sel.innerHTML = '<option value="">None</option>';
  for (const i of access.inputs.values()) { const o = el('option', null, i.name); o.value = i.id; if (i.name === want) o.selected = true; sel.appendChild(o); }
  setInput(sel.value);
}
function setInput(id) {
  if (inPort) inPort.onmidimessage = null;
  inPort = id ? access.inputs.get(id) : null;
  store.set('midiInName', inPort ? inPort.name : '');
  if (inPort) inPort.onmidimessage = onMidiIn;
}
function lightKey(n, on) { const k = document.querySelector(`.kb [data-n="${n}"]`); if (k) k.classList.toggle('down', on); }
// small readout: what arrives on MIDI in, and where the app sends it
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let actTimer = null, actClear = null;
function showActivity(st, d1, d2, outCh, srcLabel, extra) {
  const box = $('midiAct'); if (!box) return;
  const type = st & 0xF0, inCh = (st & 0x0F) + 1;
  const what = type === 0x90 && d2 > 0 ? `${NOTE_NAMES[d1 % 12]}${Math.floor(d1 / 12) - 1} on`
    : type === 0x80 || type === 0x90 ? `${NOTE_NAMES[d1 % 12]}${Math.floor(d1 / 12) - 1} off`
    : type === 0xE0 ? 'pitch bend' : type === 0xB0 ? (d1 === 1 ? 'mod wheel' : d1 === 64 ? 'sustain' : `CC ${d1}`)
    : type === 0xD0 || type === 0xA0 ? 'aftertouch' : type === 0xC0 ? 'program' : 'message';
  box.innerHTML = `<b>${srcLabel || 'In ch ' + inCh}</b> <span>${what}${extra || ''}</span> <i>→</i> <b>Out</b> ch ${outCh}`;
  box.classList.add('on'); clearTimeout(actTimer); clearTimeout(actClear);
  actTimer = setTimeout(() => box.classList.remove('on'), 400);
  actClear = setTimeout(() => { box.textContent = 'No MIDI in'; }, 3000);   // clear after three quiet seconds
}
function onMidiIn(e) {
  const [st, d1 = 0, d2 = 0] = e.data, type = st & 0xF0;
  if (st >= 0xF0) return;                                   // ignore clock and system messages
  if (!(type === 0x80 || (type === 0x90 && d2 === 0))) showActivity(st, d1, d2, playChan());
  else showActivity(st, d1, d2, inNotes.get(d1) ?? playChan());
  if (type === 0x90 && d2 > 0) {
    const ch = playChan(); inNotes.set(d1, ch); raw([0x90 | (ch - 1), d1, d2]); lightKey(d1, true); return;
  }
  if (type === 0x80 || (type === 0x90 && d2 === 0)) {
    const ch = inNotes.get(d1) ?? playChan(); inNotes.delete(d1); raw([0x80 | (ch - 1), d1, 0]); if (!held.has(d1)) lightKey(d1, false); return;
  }
  // pitch bend, mod wheel, sustain, aftertouch and other controllers follow the same channel
  const ch = playChan();
  raw(type === 0xC0 || type === 0xD0 ? [type | (ch - 1), d1] : [type | (ch - 1), d1, d2]);
}

function fillPorts() {
  const sel = $('port'), prev = store.get('port', null);
  sel.innerHTML = '';
  const outs = [...access.outputs.values()];
  if (!outs.length) { sel.innerHTML = '<option>No MIDI outputs</option>'; out = null; status('No MIDI outputs found', 'err'); return; }
  for (const o of outs) {
    const opt = el('option', null, o.name); opt.value = o.id;
    if (o.id === prev || (!prev && /drop/i.test(o.name))) opt.selected = true;
    sel.appendChild(opt);
  }
  out = access.outputs.get(sel.value); status('Connected', 'ok');
}
$('port').addEventListener('change', e => { out = access.outputs.get(e.target.value); store.set('port', e.target.value); status('Connected', 'ok'); });

// ---------- values ----------
const bag = p => p.scope === 'global' ? state.global : state.parts[part];
const getRaw = p => bag(p)[p.id];
function defaultRaw(p) {
  if (p.init != null) return p.init;
  if (p.kind === 'enum') return 0;
  if (p.kind === 'int') return p.name === 'BPM' ? 1200 : p.name === 'Highest Key' ? 127 : p.min;
  if (p.name === 'Key > DCO') return Math.round((100 + 400) / 800 * 16383);
  return p.bipolar ? 8192 : 0;
}
const shown = p => getRaw(p) ?? defaultRaw(p);
function fmt(p, r) {
  if (p.kind === 'enum') return p.options[r] ?? String(r);
  if (p.kind === 'int') return (p.labels && p.labels[r]) || (p.scale ? (r / p.scale).toFixed(1) : String(r));
  const d = p.display || { min: 0, max: 100, unit: '%' };
  const v = d.min + r / 16383 * (d.max - d.min);
  const sign = p.bipolar && v > 0.05 ? '+' : '';
  if (d.unit === 'st') return sign + v.toFixed(1) + ' st';
  if (d.unit === 'deg') return Math.round(v) + '°';
  return sign + Math.round(v) + '%';
}
const pending = new Map(); let frame = false;
function setRaw(p, r) {
  const lo = p.kind === 'range' ? 0 : p.kind === 'int' ? p.min : 0;
  const hi = p.kind === 'range' ? 16383 : p.kind === 'int' ? p.max : p.options.length - 1;
  r = Math.max(lo, Math.min(hi, Math.round(r)));
  bag(p)[p.id] = r;
  pending.set(p.id, p);
  if (!frame) { frame = true; requestAnimationFrame(flush); }
  refresh(p);
}
function flush() {
  frame = false;
  for (const p of pending.values()) nrpn(chanFor(p), p.msb, p.lsb, getRaw(p));
  pending.clear();
  store.set('state', state);
}
function refresh(p) {
  for (const c of controls) if (!p || c.p === p) c.update();
  for (const f of visRules) f();
  for (const f of viewHooks) f();
}

// ---------- controls ----------
function arcPath(a0, a1, r) {
  const pt = a => [24 + r * Math.cos(a), 24 + r * Math.sin(a)];
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}
const A0 = Math.PI * 0.75, SPAN = Math.PI * 1.5;
// Character: five named profiles at fixed points on the 0-100% range (read off the Redshift's screen).
// Past Sour the range blends back into Liquid, so Liquid also sits at 100%.
const CHARACTERS = [['Liquid', '💧', 0], ['Crisp', '🍞', 20], ['Fat', '🪜', 40], ['Mean', '😈', 60], ['Sour', '🙂', 80]];
const CHAR_STOPS = [...CHARACTERS, ['Liquid', '💧', 100]];
function characterText(pc) {
  const near = CHAR_STOPS.find(c => Math.abs(c[2] - pc) < 0.6);
  if (near) return `${near[1]} ${near[0]}`;
  const i = CHAR_STOPS.findIndex(c => c[2] > pc) - 1, a = CHAR_STOPS[i], b = CHAR_STOPS[i + 1];
  return `${a[0]} → ${b[0]}  ${Math.round((pc - a[2]) / (b[2] - a[2]) * 100)}%`;
}
// how strongly each stop is present: 1 on it, fading to 0 at the next stop
const charWeight = (at, pc) => Math.max(0, 1 - Math.abs(at - pc) / 20);
function makeCharacterStrip(p) {
  const wrap = el('div', 'ctl charstrip');
  wrap.title = `Character, NRPN ${p.msb}/${p.lsb}. Click an emoji for the pure character, drag to blend.`;
  wrap.appendChild(el('div', 'name', 'Character'));
  const track = el('div', 'cs-track'), fill = el('div', 'cs-fill'), mark = el('div', 'cs-mark');
  const labs = [];
  CHAR_STOPS.forEach(([n, e, at], i) => {
    if (i < CHAR_STOPS.length - 1) { const seg = el('div', 'cs-seg'); seg.style.left = at + '%'; seg.style.width = (CHAR_STOPS[i + 1][2] - at) + '%'; track.appendChild(seg); }
    const lab = el('button', 'cs-lab' + (at === 100 ? ' end' : ''), e); lab.style.left = at + '%'; lab.title = n + (at === 100 ? ' (wraps around)' : '');
    lab.addEventListener('click', ev => { ev.stopPropagation(); setRaw(p, Math.round(at / 100 * 16383)); });
    track.appendChild(lab); labs.push([lab, at]);
  });
  track.append(fill, mark);
  const val = el('div', 'val cs-val');
  wrap.append(track, val);
  const setFrom = e => { const r = track.getBoundingClientRect(); setRaw(p, Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 16383); };
  track.addEventListener('pointerdown', e => { if (e.target.classList.contains('cs-lab')) return; track.setPointerCapture(e.pointerId); setFrom(e); });
  track.addEventListener('pointermove', e => { if (track.hasPointerCapture(e.pointerId)) setFrom(e); });
  track.addEventListener('dblclick', () => setRaw(p, defaultRaw(p)));
  const update = () => {
    const pc = shown(p) / 16383 * 100;
    mark.style.left = pc + '%'; fill.style.width = pc + '%';
    val.textContent = characterText(pc);
    for (const [lab, at] of labs) {
      const w = charWeight(at, pc);
      lab.style.opacity = (0.3 + 0.7 * w).toFixed(2);
      lab.style.filter = `grayscale(${(1 - w).toFixed(2)})`;
      lab.style.transform = `translateX(${at === 100 ? '-100%' : at === 0 ? '0' : '-50%'}) scale(${(1 + 0.3 * w).toFixed(2)})`;
    }
    wrap.classList.toggle('unsent', getRaw(p) == null);
  };
  controls.push({ p, update, node: wrap }); update();
  return wrap;
}
function makeControl(p) {
  if (p.section === 'Character & Drive' && p.name === 'Character') return makeCharacterStrip(p);
  const wrap = el('div', 'ctl');
  if (p.kind === 'enum' && Math.max(...p.options.map(o => o.length)) > 9) wrap.classList.add('wide');
  wrap.title = `${p.section}: ${p.name}\nNRPN ${p.msb}/${p.lsb} (${p.nrpn})` + (p.note ? `\n${p.note}` : '');
  wrap.appendChild(el('div', 'name', p.name));
  const val = el('div', 'val');
  let update;
  if (p.kind === 'enum') {
    const sel = el('select');
    p.options.forEach((o, i) => { const opt = el('option', null, o); opt.value = i; sel.appendChild(opt); });
    sel.addEventListener('change', () => setRaw(p, Number(sel.value)));
    wrap.appendChild(sel);
    update = () => { sel.value = shown(p); wrap.classList.toggle('unsent', getRaw(p) == null); };
  } else {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 48 48'); svg.classList.add('knob');
    const mk = (t, a) => { const e = document.createElementNS(ns, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    mk('path', { class: 'track', d: arcPath(A0, A0 + SPAN, 21) });
    const arc = mk('path', { class: 'arc' });
    mk('circle', { class: 'body', cx: 24, cy: 24, r: 15 });
    const ind = mk('line', { class: 'ind', x1: 24, y1: 24, x2: 24, y2: 12 });
    wrap.appendChild(svg); wrap.appendChild(val);
    const lo = p.kind === 'int' ? p.min : 0, hi = p.kind === 'int' ? p.max : 16383;
    update = () => {
      const r = shown(p), f = (r - lo) / (hi - lo || 1), a = A0 + f * SPAN;
      const from = p.bipolar ? A0 + SPAN / 2 : A0;
      arc.setAttribute('d', Math.abs(a - from) < 0.01 ? '' : arcPath(Math.min(from, a), Math.max(from, a), 21));
      ind.setAttribute('x2', 24 + 11 * Math.cos(a)); ind.setAttribute('y2', 24 + 11 * Math.sin(a));
      val.textContent = fmt(p, r);
      wrap.classList.toggle('unsent', getRaw(p) == null);
    };
    let startY = 0, startR = 0;
    const perPx = e => p.kind === 'int' ? (e.shiftKey ? 1 / 16 : 1 / 6) * (hi - lo > 40 ? 4 : 1) : (hi - lo) / (e.shiftKey ? 2000 : 220);
    svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); startY = e.clientY; startR = shown(p); });
    svg.addEventListener('pointermove', e => { if (svg.hasPointerCapture(e.pointerId)) setRaw(p, startR + (startY - e.clientY) * perPx(e)); });
    svg.addEventListener('wheel', e => { e.preventDefault(); setRaw(p, shown(p) - Math.sign(e.deltaY) * (p.kind === 'int' ? 1 : (e.shiftKey ? 16 : 128))); }, { passive: false });
    svg.addEventListener('dblclick', () => setRaw(p, defaultRaw(p)));
    // click the readout to type a value (in the units shown, e.g. 128 for BPM, -12 for semitones, 45 for %)
    val.title = 'Click to type a value';
    val.addEventListener('click', () => {
      if (val.querySelector('input')) return;
      const cur = fmt(p, shown(p)).replace(/[^\d.\-+]/g, '');
      const inp = el('input', 'val-edit'); inp.type = 'text'; inp.value = cur;
      val.textContent = ''; val.appendChild(inp); inp.focus(); inp.select();
      let done = false;
      const finish = apply => {
        if (done) return; done = true;
        if (apply) {
          const x = parseFloat(inp.value);
          if (Number.isFinite(x)) {
            if (p.kind === 'int') setRaw(p, p.scale ? x * p.scale : x);
            else { const d = p.display || { min: 0, max: 100 }; setRaw(p, (x - d.min) / (d.max - d.min) * 16383); }
          }
        }
        update();
      };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
      inp.addEventListener('blur', () => finish(true));
    });
  }
  if (p.kind === 'enum') wrap.appendChild(val), val.classList.add('hidden');
  controls.push({ p, update, node: wrap }); update();
  return wrap;
}
function controlsFor(section, names) {
  const box = el('div', 'controls');
  const list = names ? names.map(n => BY[section][n]) : Object.values(BY[section]);
  for (const p of list) box.appendChild(makeControl(p));
  return box;
}

// ---------- layout ----------
function moduleEl(title, global) { const m = el('div', 'module m-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + (global ? ' global' : '')); m.appendChild(el('h3', null, title)); return m; }
function tabbed(mod, names, build) {
  mod.classList.add('tabbed');
  const bar = el('div', 'tabs'), panes = [];
  names.forEach((n, i) => {
    const b = el('button', i ? '' : 'on', n); bar.appendChild(b);
    const pane = el('div', i ? 'hidden' : ''); build(pane, n); panes.push(pane);
    b.addEventListener('click', () => { [...bar.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); panes.forEach(x => x.classList.add('hidden')); pane.classList.remove('hidden'); scheduleFit(); });
  });
  mod.appendChild(bar); panes.forEach(x => mod.appendChild(x));
}
function buildMath(pane, sec) {
  const box = controlsFor(sec);
  pane.appendChild(box);
  const items = [...box.children];
  const ps = Object.values(BY[sec]);
  visRules.push(() => {
    const eng = BY[sec]['Engine'].options[shown(BY[sec]['Engine'])];
    const keep = new Set(['Engine', ...(MAP.mathEngineParams[eng] || [])]);
    items.forEach((node, i) => node.classList.toggle('hidden', !keep.has(ps[i].name)));
  });
}
function buildFx(mod) {
  mod.appendChild(controlsFor('FX'));
  const engines = ['Stage Reverb', 'X-Delay', 'Vintage Chorus', 'Chorus+'];
  const subs = engines.map(e => { const s = el('div'); s.appendChild(el('div', 'subhead', e)); s.appendChild(controlsFor(e)); mod.appendChild(s); return s; });
  visRules.push(() => { const i = shown(BY['FX']['FX Engine']); subs.forEach((s, k) => s.classList.toggle('hidden', k !== i)); });
}
function buildLayout() {
  const main = $('main');
  // Part panel
  const pp = el('section', 'panel');
  const t1 = el('div', 'panel-title'); t1.appendChild(el('h2', null, 'Part')); const tag = el('span', 'tag'); tag.id = 'partTag'; t1.appendChild(tag); pp.appendChild(t1);
  const rowA = el('div', 'row r3');
  const dco = moduleEl('DCO'); dco.appendChild(controlsFor('DCO')); rowA.appendChild(dco);
  const cd = moduleEl('Character & Drive'); cd.appendChild(controlsFor('Character & Drive')); rowA.appendChild(cd);
  const vcf = moduleEl('VCF'); vcf.appendChild(controlsFor('VCF'));
  const mt = el('div'); mt.appendChild(el('div', 'subhead', 'Mirror Twins engine')); mt.appendChild(controlsFor('Mirror Twins')); vcf.appendChild(mt);
  visRules.push(() => mt.classList.toggle('hidden', shown(BY['VCF']['Engine']) !== 1));
  rowA.appendChild(vcf); pp.appendChild(rowA);
  const rowB = el('div', 'row r4');
  for (const [t, s] of [['Amp', 'Amp'], ['Perform', 'Perform'], ['Parts & Voices', 'Parts'], ['Key & Wheel', 'Key & Wheel']]) { const m = moduleEl(t); m.appendChild(controlsFor(s)); if (s === 'Parts') m.querySelector('.controls').appendChild(makeGroupControl()); rowB.appendChild(m); }
  pp.appendChild(rowB);
  const rowC = el('div', 'row r2');
  const env = moduleEl('Envelopes'); tabbed(env, ['Amp Env', 'VCF Env', 'DCO Env', 'Aux Env'], (pane, s) => pane.appendChild(controlsFor(s))); rowC.appendChild(env);
  const lfo = moduleEl('LFOs'); tabbed(lfo, ['LFO 1', 'LFO 2', 'LFO 3', 'LFO 4'], (pane, s) => pane.appendChild(controlsFor(s))); rowC.appendChild(lfo);
  const rowCD = el('div', 'rowCD'); rowCD.appendChild(rowC); pp.appendChild(rowCD);
  const rowD = el('div', 'row r21');
  const math = moduleEl('Math'); tabbed(math, ['Math 1', 'Math 2', 'Math 3', 'Math 4'], buildMath); rowD.appendChild(math);
  const arp = moduleEl('Arp / Seq'); arp.appendChild(controlsFor('Arp / Seq')); rowD.appendChild(arp);
  rowCD.appendChild(rowD);
  main.appendChild(pp);
  // Global panel
  const gp = el('section', 'panel');
  const t2 = el('div', 'panel-title'); t2.appendChild(el('h2', null, 'Global')); const tag2 = el('span', 'tag'); tag2.id = 'globalTag'; t2.appendChild(tag2); gp.appendChild(t2);
  const rowE = el('div', 'row r21');
  const fx = moduleEl('FX', true); buildFx(fx); rowE.appendChild(fx);
  const clk = moduleEl('Clock', true); clk.appendChild(controlsFor('Clock')); rowE.appendChild(clk);
  gp.appendChild(rowE);
  const rowF = el('div', 'row r1');
  const mac = moduleEl('Macros', true); mac.appendChild(controlsFor('Macros')); decorateMacros(mac); rowF.appendChild(mac);
  gp.appendChild(rowF);
  main.appendChild(gp);
  // modules with only a few controls: centre them and give them bigger knobs
  main.querySelectorAll('.module').forEach(m => {
    if (m.classList.contains('tabbed') || m.classList.contains('m-character-drive')) return;
    if (m.querySelectorAll('.ctl').length <= 3) m.classList.add('sparse');
    const kids = [...m.children].filter(c => c.tagName !== 'H3');
    if (kids.length === 1 && kids[0].classList.contains('controls')) m.classList.add('single');   // one block of controls: centre it vertically too
  });
}

// ---------- Group (hand-set on the Redshift, recorded in the app) ----------
function setGroup(i, g) {
  if (state.groups[i] === g) return;
  state.groupPrev ||= ['Off', 'Off', 'Off', 'Off', 'Off', 'Off'];
  if (state.groupDone[i]) state.groupPrev[i] = state.groups[i];      // what the Redshift is set to now
  state.groups[i] = g; state.groupDone[i] = g === state.groupPrev[i]; // changed back: nothing to do
  store.set('state', state); paintGroupBadges(); refresh();
}
function makeGroupControl() {
  const wrap = el('div', 'ctl handset');
  wrap.title = 'Set by hand on the Redshift: [PARTS], then the Group soft knob. Changing it here adds a step to the to-do window.';
  wrap.appendChild(el('div', 'name', 'Group'));
  const sel = el('select'); ['Off', 'A', 'B', 'C'].forEach(g => { const o = el('option', null, g); o.value = g; sel.appendChild(o); });
  sel.addEventListener('change', () => setGroup(part, sel.value));
  const note = el('div', 'val'); wrap.append(sel, note);
  const update = () => { sel.value = state.groups[part]; note.textContent = state.groupDone[part] ? 'set by hand' : 'to do by hand'; wrap.classList.toggle('pending', !state.groupDone[part]); };
  controls.push({ p: null, update, node: wrap }); update();
  return wrap;
}
function paintGroupBadges() {
  [...$('parts').querySelectorAll('.hex')].forEach((b, i) => {
    const g = state.groups[i]; b.dataset.group = g !== 'Off' ? g : '';
    b.title = `Part ${i + 1}` + (g !== 'Off' ? ` · Group ${g}` : '');
  });
}

// ---------- Macro names ----------
function macroRoutes(i) {
  const out = [];
  state.routes.forEach((list, pi) => list.forEach(r => { if (r.src === `Macro ${i + 1}`) out.push(`P${pi + 1} ${r.dest} ${r.amt > 0 ? '+' : ''}${r.amt}%`); }));
  for (let m = 1; m <= 4; m++) {   // Macro feeding a Math slot on the selected part (live)
    const sec = BY[`Math ${m}`]; if (!sec) continue;
    for (const n of ['Source 1', 'Source 2', 'Source 3', 'Source 4', 'Control', 'Via 1', 'Via 2', 'Via 3'])
      if (sec[n] && sec[n].options[shown(sec[n])] === `Macro ${i + 1}`) { out.push(`P${part + 1} Math ${m}`); break; }
  }
  return out;
}
function decorateMacros(mod) {
  const ctls = [...mod.querySelectorAll('.ctl')];
  const lines = [];
  ctls.forEach((c, i) => {
    c.classList.add('macro');
    const inp = el('input', 'macro-name'); inp.type = 'text'; inp.maxLength = 14; inp.placeholder = 'name…'; inp.value = state.macroNames[i] || '';
    inp.title = `Name Macro ${i + 1} (saved with patches)`;
    inp.addEventListener('input', () => { state.macroNames[i] = inp.value.trim(); store.set('state', state); for (const f of viewHooks) f(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    c.insertBefore(inp, c.querySelector('.name'));
    const what = el('div', 'macro-what'); c.appendChild(what); lines.push([what, inp, i]);
  });
  const upd = () => lines.forEach(([what, inp, i]) => {
    const r = macroRoutes(i); what.textContent = r.length ? r.join(', ') : 'not assigned'; what.classList.toggle('none', !r.length); what.title = r.join('\n');
    if (document.activeElement !== inp) inp.value = state.macroNames[i] || '';
  });
  viewHooks.push(upd); upd();
}

// ---------- bigger knobs where a panel has room ----------
// Measures the layout at normal size, locks each panel's width, then grows its knobs as far as they fit
// without adding rows or overflowing, so the arrangement of panels never changes.
function rowsOf(box) { const tops = new Set(); for (const c of box.children) if (c.offsetParent && c.classList.contains('ctl')) tops.add(c.offsetTop); return tops.size; }
function fitKnobs() {
  const main = $('main'); if (!main || main.classList.contains('hidden')) return;
  const mods = [...main.querySelectorAll('.module')].filter(m => !m.classList.contains('sparse') && !m.classList.contains('m-character-drive'));
  for (const m of main.querySelectorAll('.module')) { m.style.flex = ''; m.style.minWidth = ''; m.style.removeProperty('--ks'); }
  const widths = [...main.querySelectorAll('.module')].map(m => [m, Math.floor(m.getBoundingClientRect().width)]);
  for (const [m, w] of widths) { m.style.flex = `1 1 ${w}px`; m.style.minWidth = '0'; }
  for (const m of mods) {
    const boxes = [...m.querySelectorAll('.controls')].filter(b => b.offsetParent);
    const base = boxes.map(rowsOf);
    const fits = () => m.scrollWidth <= m.clientWidth + 1 && boxes.every((b, i) => rowsOf(b) <= base[i] && b.scrollWidth <= b.clientWidth + 1);
    let lo = 1, hi = 1.5;
    m.style.setProperty('--ks', hi);
    if (fits()) lo = hi;
    else for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; m.style.setProperty('--ks', mid.toFixed(3)); if (fits()) lo = mid; else hi = mid; }
    m.style.setProperty('--ks', lo.toFixed(3));
  }
}
let fitPending = false;
function scheduleFit() { if (fitPending) return; fitPending = true; requestAnimationFrame(() => { fitPending = false; fitKnobs(); }); }
window.addEventListener('resize', () => { clearTimeout(window.__fitT); window.__fitT = setTimeout(fitKnobs, 120); });
document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#main')) scheduleFit(); });

// ---------- header ----------
function selectPart(i) {
  part = i;
  document.documentElement.style.setProperty('--part', `var(--p${i + 1})`);
  [...$('parts').querySelectorAll('.hex')].forEach((b, k) => b.classList.toggle('active', k === i));
  $('partTag').textContent = `Part ${i + 1} on MIDI channel ${settings.parts[i]}`;
  $('globalTag').textContent = `Shared by all parts, sent on the Perform channel (${settings.perform})`;
  $('kbTag').textContent = 'Plays ' + playLabel();
  refresh();
}
function setSize(sz) {
  document.body.classList.remove('size-s', 'size-m', 'size-l'); document.body.classList.add('size-' + sz);
  document.querySelectorAll('.sizes button').forEach(b => b.classList.toggle('on', b.dataset.size === sz));
  store.set('size', sz);
  if (typeof render === 'function') render();
}
function buildHeader() {
  setSize('s');   // one compact size only
  for (let i = 0; i < 6; i++) {
    const b = el('button', 'hex', String(i + 1)); b.style.setProperty('--c', `var(--p${i + 1})`);
    b.addEventListener('click', () => selectPart(i)); $('parts').appendChild(b);
  }
  paintGroupBadges();
  $('clearPart').addEventListener('click', () => {
    if (!confirm(`Clear the app's record of Part ${part + 1}? Do this after Init Active Part on the Redshift.`)) return;
    state.parts[part] = {}; state.routes[part] = []; store.set('state', state); refresh();
  });
  // settings dialog
  const grid = $('chanGrid');
  const chanSel = (val, onChange) => { const s = el('select'); for (let c = 1; c <= 16; c++) { const o = el('option', null, String(c)); o.value = c; s.appendChild(o); } s.value = val; s.addEventListener('change', () => onChange(Number(s.value))); return s; };
  grid.appendChild(el('span', null, 'Perform')); grid.appendChild(chanSel(settings.perform, v => { settings.perform = v; store.set('settings', settings); selectPart(part); }));
  for (let i = 0; i < 6; i++) { grid.appendChild(el('span', null, `Part ${i + 1}`)); grid.appendChild(chanSel(settings.parts[i], v => { settings.parts[i] = v; store.set('settings', settings); selectPart(part); })); }
  for (let g = 0; g < 3; g++) { grid.appendChild(el('span', null, `Group ${'ABC'[g]}`)); grid.appendChild(chanSel(settings.groups[g], v => { settings.groups[g] = v; store.set('settings', settings); selectPart(part); })); }
  grid.appendChild(el('span', null, 'Message spacing'));
  const sp = el('select');
  [1, 2, 3, 4, 6, 8, 12, 16].forEach(ms => { const o = el('option', null, ms + ' ms per parameter'); o.value = ms; sp.appendChild(o); });
  sp.value = settings.spacing; sp.id = 'spacingSel';
  sp.addEventListener('change', () => { settings.spacing = Number(sp.value); store.set('settings', settings); });
  grid.appendChild(sp);
  $('openSettings').addEventListener('click', () => { $('spacingSel').value = settings.spacing; $('settings').showModal(); });
  $('closeSettings').addEventListener('click', () => $('settings').close());
}

// ---------- keyboard ----------
let base = 36, hold = false;
const KB_SPAN = 48;   // four octaves on screen
const held = new Map();   // key note -> [notes sent]
const KEYMAP = 'awsedftgyhujkolp;\''.split('');
function noteName(n) { return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12] + (Math.floor(n / 12) - 1); }
function chordNotes(n) { return $('chord').value.split(',').map(x => n + Number(x)).filter(x => x <= 127); }
function keyOn(n, src = 'Screen keys') {
  if (held.has(n)) { if (hold) keyOff(n, true); return; }
  const ch = playChan(), notes = chordNotes(n), v = Number($('vel').value);
  notes.forEach(x => raw([0x90 | (ch - 1), x, v]));
  held.set(n, { ch, notes });
  showActivity(0x90, n, v, ch, src, notes.length > 1 ? ' chord' : '');
  const k = document.querySelector(`.kb [data-n="${n}"]`); if (k) k.classList.add('down');
}
function keyOff(n, force, src = 'Screen keys') {
  if (hold && !force) return;
  const h = held.get(n); if (!h) return;
  h.notes.forEach(x => raw([0x80 | (h.ch - 1), x, 0]));
  held.delete(n);
  if (!force) showActivity(0x80, n, 0, h.ch, src, h.notes.length > 1 ? ' chord' : '');
  const k = document.querySelector(`.kb [data-n="${n}"]`); if (k) k.classList.remove('down');
}
function buildKeyboard() {
  const kb = $('kb'); kb.innerHTML = '';
  const whites = [], blacks = [];
  for (let i = 0; i <= KB_SPAN; i++) ([1, 3, 6, 8, 10].includes(i % 12) ? blacks : whites).push(i);
  const w = 100 / whites.length;
  whites.forEach((i, k) => {
    const d = el('div', 'w'); d.dataset.n = base + i; d.style.left = (k * w) + '%'; d.style.width = w + '%';
    const lbl = el('div', 'lbl', (i % 12 === 0 ? noteName(base + i) + ' ' : '') + (KEYMAP[i] ? KEYMAP[i].toUpperCase() : '')); d.appendChild(lbl);
    kb.appendChild(d);
  });
  blacks.forEach(i => {
    const k = whites.filter(x => x < i).length;
    const d = el('div', 'b'); d.dataset.n = base + i; d.style.left = (k * w - w * 0.3) + '%'; d.style.width = (w * 0.6) + '%';
    d.appendChild(el('div', 'lbl', KEYMAP[i] ? KEYMAP[i].toUpperCase() : '')); kb.appendChild(d);
  });
  $('octLabel').textContent = `${noteName(base)} to ${noteName(base + KB_SPAN)}`;
}
function setupKeyboard() {
  buildKeyboard();
  $('midiIn').addEventListener('change', e => { for (const [n, ch] of inNotes) raw([0x80 | (ch - 1), n, 0]); inNotes.clear(); setInput(e.target.value); });
  $('playOn').value = playTarget;
  $('playOn').addEventListener('change', e => { [...held.keys()].forEach(n => keyOff(n, true)); playTarget = e.target.value; store.set('playTarget', playTarget); $('kbTag').textContent = 'Plays ' + playLabel(); });
  const kb = $('kb');
  kb.addEventListener('pointerdown', e => { const k = e.target.closest('[data-n]'); if (!k) return; kb.setPointerCapture(e.pointerId); kb._n = Number(k.dataset.n); keyOn(kb._n); });
  const up = () => { if (kb._n != null) { keyOff(kb._n); kb._n = null; } };
  kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
  $('hold').addEventListener('click', () => { hold = !hold; $('hold').textContent = 'Hold: ' + (hold ? 'on' : 'off'); $('hold').classList.toggle('on', hold); if (!hold) [...held.keys()].forEach(n => keyOff(n, true)); });
  const shift = d => { [...held.keys()].forEach(n => keyOff(n, true)); base = Math.max(0, Math.min(127 - KB_SPAN, base + d)); buildKeyboard(); };
  $('octDown').addEventListener('click', () => shift(-12)); $('octUp').addEventListener('click', () => shift(12));
  $('panic').addEventListener('click', () => { [...held.keys()].forEach(n => keyOff(n, true)); for (let c = 1; c <= 16; c++) cc(c, 123, 0); });
  // Only real text fields keep the typing keys. Dropdowns, buttons and sliders hand them back to the keyboard.
  const typing = e => (e.target.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes(e.target.type)) || e.target.tagName === 'TEXTAREA' || e.target.closest('dialog[open]');
  document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') e.target.blur(); });
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    const k0 = e.key.toLowerCase();
    if (KEYMAP.includes(k0) || k0 === 'z' || k0 === 'x') {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') { e.preventDefault(); e.target.blur(); }   // don't let a focused dropdown eat the note
      if (e.repeat) return;
    } else return;
    const k = e.key.toLowerCase();
    if (k === 'z') return shift(-12); if (k === 'x') return shift(12);
    const i = KEYMAP.indexOf(k); if (i >= 0) keyOn(base + i, 'Computer keys');
  });
  document.addEventListener('keyup', e => { if (typing(e)) return; const i = KEYMAP.indexOf(e.key.toLowerCase()); if (i >= 0) keyOff(base + i, false, 'Computer keys'); });
  // if the window loses focus while keys are down, release them so notes don't hang
  window.addEventListener('blur', () => { if (!hold) [...held.keys()].forEach(n => keyOff(n, true)); });
}

// ---------- patch sending ----------
const partParams = () => {
  const ps = PARAMS.filter(p => p.scope === 'part');
  const first = p => (p.name === 'Engine' || p.name === 'Enabled' || p.section === 'Parts') ? 0 : 1;
  return ps.slice().sort((a, b) => first(a) - first(b));   // engines and voice settings before the rest
};
let busy = false;
function sendBurst(entries, spacing, label, partIdx = part) {
  // entries: [[param, rawValue], ...]; each NRPN scheduled at its own time so the DIN line never overflows
  if (!out) { status('Pick a MIDI output first', 'err'); return Promise.resolve(false); }
  if (busy) return Promise.resolve(false);
  busy = true;
  const chan = settings.parts[partIdx], t0 = performance.now() + 30;
  entries.forEach(([p, v], i) => {
    const t = t0 + i * spacing;
    out.send([0xB0 | (chan - 1), 99, p.msb], t); out.send([0xB0 | (chan - 1), 98, p.lsb], t);
    out.send([0xB0 | (chan - 1), 6, (v >> 7) & 0x7F], t); out.send([0xB0 | (chan - 1), 38, v & 0x7F], t);
  });
  lastAddr[chan] = null;
  const total = entries.length * spacing + 60;
  status(`${label}: sending ${entries.length} parameters…`, 'ok');
  return new Promise(res => setTimeout(() => { busy = false; status(`${label}: sent ${entries.length} parameters in ${(total / 1000).toFixed(1)} s`, 'ok'); res(true); }, total));
}
function sendPart(label, partIdx = part) {
  const bagp = state.parts[partIdx];
  const entries = partParams().map(p => { if (bagp[p.id] == null) bagp[p.id] = defaultRaw(p); return [p, bagp[p.id]]; });
  store.set('state', state); refresh();
  return sendBurst(entries, settings.spacing, label, partIdx);
}
// Like the Redshift's own Init preset: every part reset, Part 1 on, Parts 2-6 off, effects off (Arena reverb ready)
async function initAll() {
  if (!out) { status('Pick a MIDI output first', 'err'); return; }
  const en = BY['Parts']['Enabled'];
  for (let i = 0; i < 6; i++) {
    state.parts[i] = {}; state.routes[i] = [];
    state.parts[i][en.id] = i === 0 ? 1 : 0;
    const ok = await sendPart(`Init all: Part ${i + 1} of 6`, i);
    if (!ok) { status('Init all stopped: MIDI busy or no output', 'err'); return; }
  }
  setRaw(BY['FX']['FX On'], 0); setRaw(BY['FX']['FX Engine'], 0); setRaw(BY['Stage Reverb']['Stage'], BY['Stage Reverb']['Stage'].options.indexOf('Arena'));
  selectPart(0); status('Init all: Part 1 on, Parts 2–6 off, effects off', 'ok'); audition();
}
// part buttons dim when that part is switched off
function paintEnabled() {
  const en = BY['Parts'] && BY['Parts']['Enabled']; if (!en) return;
  [...$('parts').querySelectorAll('.hex')].forEach((b, i) => {
    const off = state.parts[i][en.id] === 0;
    b.classList.toggle('disabled', off);
    b.title = `Part ${i + 1}` + (state.groups[i] !== 'Off' ? ` · Group ${state.groups[i]}` : '') + (off ? ' · switched off (Parts & Voices › Enabled)' : '');
  });
}
function audition() {
  const ch = playChan();
  [48, 55, 60].forEach(n => raw([0x90 | (ch - 1), n, 100]));
  setTimeout(() => [48, 55, 60].forEach(n => raw([0x80 | (ch - 1), n, 0])), 900);
}
// Speed test: a full part send with eight marker values placed last, where dropped messages show up first
const MARKERS = [['VCF', 'Cutoff', 37], ['VCF', 'Resonance', 63], ['DCO', 'Detune', 21], ['DCO', 'Noise', 12], ['Amp Env', 'Release', 44], ['LFO 4', 'Rate', 71], ['Math 4', 'Rise', 29], ['Parts', 'Spread', 58]];
function runSpeedTest(spacing) {
  const bagp = state.parts[part], markerIds = new Set();
  const marks = MARKERS.map(([s, n, pc]) => { const p = BY[s][n]; markerIds.add(p.id); const v = Math.round(pc / 100 * 16383); bagp[p.id] = v; return [p, v]; });
  const rest = partParams().filter(p => !markerIds.has(p.id)).map(p => { if (bagp[p.id] == null) bagp[p.id] = defaultRaw(p); return [p, bagp[p.id]]; });
  store.set('state', state); refresh();
  $('stList').innerHTML = MARKERS.map(([s, n, pc]) => `<li><b>${s}</b> ${n}: <b>${pc}%</b></li>`).join('');
  $('stInfo').textContent = `Sending ${rest.length + marks.length} parameters at ${spacing} ms each to Part ${part + 1}. Then check these on the Redshift:`;
  return sendBurst(rest.concat(marks), spacing, 'Speed test');
}
// Save / load: values stored by name so files stay readable and survive app updates
// small in-page text box (the Mac app has no browser prompt())
function askText(title, value) {
  return new Promise(res => {
    const d = el('dialog', 'ask'); d.innerHTML = '<h2></h2><input type="text"><div class="actions"><button data-v="0">Cancel</button><button data-v="1" class="primary">OK</button></div>';
    d.querySelector('h2').textContent = title; const inp = d.querySelector('input'); inp.value = value || '';
    const done = ok => { const v = inp.value.trim(); d.close(); d.remove(); res(ok && v ? v : null); };
    d.querySelectorAll('button').forEach(b => b.addEventListener('click', () => done(b.dataset.v === '1')));
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    d.addEventListener('cancel', e => { e.preventDefault(); done(false); });
    document.body.appendChild(d); d.showModal(); inp.focus(); inp.select();
  });
}
async function savePatch() {
  const name = await askText('Name this patch', 'Untitled'); if (name == null) return;
  const values = {};
  for (const p of partParams()) { const r = state.parts[part][p.id] ?? defaultRaw(p); values[`${p.section} / ${p.name}`] = { raw: r, shows: fmt(p, r) }; }
  const blob = new Blob([JSON.stringify({ name, app: 'Rubra VI', firmware: MAP.firmware, saved: new Date().toISOString(), routes: state.routes[part], macroNames: state.macroNames, group: state.groups[part], part: values }, null, 1)], { type: 'application/json' });
  const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name.replace(/[^\w\- ]+/g, '').trim() + '.rs6patch.json'; a.click();
}
function loadPatch(file) {
  file.text().then(txt => {
    const data = JSON.parse(txt), bagp = {};
    let missing = 0;
    for (const p of partParams()) { const v = data.part && data.part[`${p.section} / ${p.name}`]; if (v && Number.isFinite(v.raw)) bagp[p.id] = v.raw; else { bagp[p.id] = defaultRaw(p); missing++; } }
    state.parts[part] = bagp;
    if (['Off', 'A', 'B', 'C'].includes(data.group) && data.group !== state.groups[part]) { setGroup(part, data.group); }
    if (Array.isArray(data.macroNames)) state.macroNames = data.macroNames.slice(0, 8).concat(Array(8).fill('')).slice(0, 8);
    state.routes[part] = Array.isArray(data.routes) ? data.routes.map(r => Object.assign({ via: null, viaAmt: 0, done: false }, r)) : [];
    return sendPart(`Loaded "${data.name || file.name}"`).then(() => { if (missing) status(`Loaded; ${missing} parameters were missing and set to init`, 'ok'); audition(); });
  }).catch(e => status('Could not read that patch file: ' + e.message, 'err'));
}
function setupPatchTools() {
  $('initAll').addEventListener('click', () => {
    if (!confirm('Initialise all six parts, like Init preset on the Redshift?\n\nPart 1 gets the init sound and is switched on, Parts 2–6 are reset and switched off, the effects are turned off, and the app\'s routing lists are cleared.\n\nTo clear the routings on the Redshift too, press [SHIFT] + [PERFORM] there first.')) return;
    initAll();
  });
  viewHooks.push(paintEnabled);
  $('initPart').addEventListener('click', () => {
    if (!confirm(`Send the init patch to Part ${part + 1}? This replaces every part setting, clears the app's routing list and turns the effects off (they're shared by all parts).\n\nTo clear the routings on the Redshift too, press [SHIFT] + [PART] there first.`)) return;
    state.parts[part] = {}; state.routes[part] = []; sendPart('Init patch').then(ok => { if (!ok) return; setRaw(BY['FX']['FX On'], 0); setRaw(BY['FX']['FX Engine'], 0); setRaw(BY['Stage Reverb']['Stage'], BY['Stage Reverb']['Stage'].options.indexOf('Arena')); audition(); });   // a fresh patch starts dry: FX off (global)
  });
  $('sendPart').addEventListener('click', () => sendPart('Send part').then(ok => ok && audition()));
  $('savePatch').addEventListener('click', savePatch);
  $('loadPatch').addEventListener('click', () => $('patchFile').click());
  $('patchFile').addEventListener('change', e => { if (e.target.files[0]) loadPatch(e.target.files[0]); e.target.value = ''; });
  $('audition').addEventListener('click', audition);
  let testSpacing = settings.spacing;
  const showSpacing = () => { $('stSpacing').textContent = testSpacing + ' ms'; };
  $('speedTest').addEventListener('click', () => { testSpacing = settings.spacing; showSpacing(); $('stList').innerHTML = ''; $('stInfo').textContent = 'Press Run to send a full part with eight marker values at the end.'; $('stResult').textContent = ''; $('speedDlg').showModal(); });
  $('stRun').addEventListener('click', () => runSpeedTest(testSpacing));
  $('stGood').addEventListener('click', () => {
    settings.spacing = testSpacing; store.set('settings', settings);
    const next = Math.max(1, Math.floor(testSpacing / 2));
    $('stResult').textContent = `${testSpacing} ms works and is saved. ` + (next < testSpacing ? `Run again to try ${next} ms.` : 'That is the fastest setting.');
    if (next < testSpacing) { testSpacing = next; showSpacing(); }
  });
  $('stBad').addEventListener('click', () => {
    testSpacing = Math.min(16, testSpacing * 2); showSpacing();
    $('stResult').textContent = `Slowing down. Saved setting stays at ${settings.spacing} ms; run again at ${testSpacing} ms.`;
  });
  $('stClose').addEventListener('click', () => $('speedDlg').close());
}

// ---------- start ----------
fetch('params.json').then(r => r.json()).then(m => {
  MAP = m; PARAMS = m.params;
  for (const p of PARAMS) (BY[p.section] ||= {})[p.name] = p;
  buildHeader(); buildLayout(); setupKeyboard(); setupPatchTools(); selectPart(0); setupModView();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitKnobs);
}).catch(err => { $('main').textContent = 'Could not load params.json. Try reloading the page. (' + err.message + ')'; });

if (!navigator.requestMIDIAccess) status('No Web MIDI here: use Chrome or Edge', 'err');
else navigator.requestMIDIAccess({ sysex: false }).then(a => { access = a; fillPorts(); fillInputs(); a.onstatechange = () => { fillPorts(); fillInputs(); }; }, err => status('MIDI refused: ' + err.message, 'err'));
