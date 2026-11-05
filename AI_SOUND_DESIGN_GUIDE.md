# Rubra VI — guide for AI assistants

Give this file to Claude (or a similar assistant) so it can design sounds for the **Rubra VI** app (an editor for the Redshift 6). The assistant writes a patch file; you load it in the app with **Load patch…**, which sends every setting to the Redshift 6 over MIDI. Anything MIDI can't reach is listed as steps to do **by hand** on the Redshift.

Based on the Redshift 6 manual, firmware 1.7 (Appendix D, MIDI implementation). All values below were confirmed on hardware.

## How the assistant should work

1. Ask, or take from the request: the sound, which part (1–6), and whether it is a single part or several.
2. Write a complete patch file (format below) with **every part parameter**. Start from a plain init sound (both oscillators saw, filter open, envelopes open, part enabled, volume about 80%) and change what the sound needs.
3. Put every Mod Matrix connection in `routes`. These are done by hand on the Redshift, so keep them few and ordered by importance. Do as much shaping as possible inside the four Math slots, whose inputs *are* set over MIDI.
4. Explain the sound in a sentence or two and list the by-hand steps.
5. For changes ("darker", "faster throb"), change only what the request touches and write a new version of the file.

## What can and can't be set over MIDI

| Set by the app over MIDI | Done by hand on the Redshift |
|---|---|
| Every parameter in the tables below | **Mod Matrix routings** (source → destination, amount, via): 32 slots per part, none MIDI-addressable |
| Math slot engines and **their inputs** (Source 1–4, Control, Trigger, Vias) | **Part Group** (Off/A/B/C) on the [PARTS] page |
| Macro values 1–8 (global) | **What a Macro controls** (that's a Mod Matrix routing with the Macro as source) |
| Arp/Seq settings (engine, rate, length) | **Sequencer step notes**, gates, velocities, glides |
| | Saving the result as a Redshift preset ([SHIFT] + [OK]) |

Other facts that matter:
- Parameters go to the part's own channel (default Part 1 = channel 2 … Part 6 = channel 7). Global parameters (FX, Clock, Macros) go to the Perform channel (default 1). Group channels ignore parameter changes.
- FX are global and affect every part on Main Out: only change them when asked.
- Six voices are shared by all parts. Poly × Unison must fit in six. Paraphony (Para 2–5) plays several notes on one voice sharing its filter; DCO Stack limits it. Voices = Reserve stops other parts stealing a part's voices.
- Amp Env always drives the amp; VCF Env drives cutoff through VCF / Env Amt; DCO Env shapes paraphonic oscillator levels. These need no routing.
- **Character** sweeps five profiles: Liquid at 0%, Crisp 20%, Fat 40%, Mean 60%, Sour 80%, blending back to Liquid at 100%. Values between blend neighbours.
- Drive: lower for paraphonic sounds, higher for monophonic ones.
- LFOs with Sync = Clock use **Clock Div** for their rate and follow the master clock (external MIDI clock if present, otherwise the BPM).
- The [MATH] button can't quick-assign yet, so routings from Math or from Macros 2–8 are made on the [MOD MATRIX] page.

## Patch file format

A JSON file named `<Name>.rs6patch.json`:

```json
{
  "name": "Throbbing Bass",
  "description": "One or two sentences about the sound.",
  "app": "Rubra VI",
  "firmware": "1.7",
  "group": "Off",
  "macroNames": ["Brightness", "Squelch", "", "", "", "", "", ""],
  "routes": [
    { "src": "LFO 1", "dest": "Cutoff", "amt": 45, "via": null, "viaAmt": 0, "done": false, "why": "the throb" },
    { "src": "Math 1", "dest": "Cutoff", "amt": 20, "via": null, "viaAmt": 0, "done": false, "why": "stepped brightness" }
  ],
  "part": {
    "VCF / Cutoff": { "raw": 3932, "shows": "24%" },
    "LFO 1 / Wave": { "raw": 4, "shows": "RevSaw" },
    "Parts / Poly": { "raw": 1, "shows": "1" }
  }
}
```

- `part` holds **every part parameter** (207 of them), keyed `"Section / Name"` exactly as in the tables below. `raw` is what is sent; `shows` is for people and is ignored on load. Missing parameters fall back to init values.
- **raw values:**
  - *range*: 0–16383 mapped linearly onto the displayed range. Unipolar 0–100%: raw = percent ÷ 100 × 16383. Bipolar: raw = (value − min) ÷ (max − min) × 16383, so 0 is 8192. Example: Tune 2 −12 st → (−12 + 24) ÷ 48 × 16383 = 4096.
  - *int*: the number itself (BPM is sent × 10, e.g. 1200 = 120 BPM).
  - *enum*: the index of the option, counting from 0, in the order listed.
- `routes`: `src` is a modulation source, `dest` a destination (lists below), `amt` −100…100, `via` a source or null, `viaAmt` 0…100. Set `done` to false; the person ticks each off after doing it by hand.
- `group`: Off, A, B or C (done by hand). `macroNames`: up to eight short names (14 characters) for the performance Macros.

## Modulation sources (for routes, Math inputs and vias)

DCO Env, VCF Env, Amp Env, Aux Env, LFO 1, LFO 2, LFO 3, LFO 4, Vel, Off Vel, AT, Key, Gate, ModWheel, PB, VoiceIdx, VoiceAlt, VoiceRnd, Uni Idx, Uni Alt, Poly Idx, Poly Alt, Note Rnd, CC74, ArpSeq, Macro 1, Macro 2, Macro 3, Macro 4, Macro 5, Macro 6, Macro 7, Macro 8, Math 1, Math 2, Math 3, Math 4

Math **Trigger** inputs use: None, NoteOn, NoteOnPt, NoteOff, NteOffPt, LFO1, LFO2, LFO3, LFO4.

## Modulation destinations (for routes)

Cutoff, Reso, Mode, Separat, Depth, Pitch, Tune2, Detune, Balance, Noise, PW1, PW2, Charactr, Drive, Gain, Volume, Pan, LFO 1 Hz, LFO 2 Hz, LFO 3 Hz, LFO 4 Hz, Amp Atk, Amp Dec, Amp Sus, Amp Rel, VCF Atk, VCF Dec, VCF Sus, VCF Rel, DCO Atk, DCO Dec, DCO Sus, DCO Rel, Aux Atk, Aux Dec, Aux Sus, Aux Rel

## Math slots: which settings each engine uses

- **SLEW:** Source 1, Rise, Fall
- **CURVE:** Source 1, Src Gain, Src Bias, Split, Shelf, Curve Lo, Curve Hi
- **FOLD & CLIP:** Source 1, Src Gain, Src Bias, Min, Min Op, Max, Max Op
- **QUANTIZE:** Source 1, Src Gain, Src Bias, Quant
- **MULTI-VIA:** Source 1, Via 1, Via 1 Amt, Via 2, Via 2 Amt, Via 3, Via 3 Amt
- **SAMPLE & HOLD:** Source 1, Trigger
- **TRACK & HOLD:** Source 1, Control, Thresh, Active
- **SWITCH:** Trigger, Source 1, Source 2, Source 3, Source 4
- **CROSSFADE:** Control, Xfade, Source 1, Source 2, Source 3, Source 4

`Source 1` is the engine's main input ("Src"). Src Gain (−200…+200%) and Src Bias (−100…+100%) scale and offset that input before processing. A Math slot's output is a source called `Math 1`…`Math 4`; it reaches a destination only through a by-hand route. Math slots can feed each other (avoid loops).

## Parameter reference

### Character & Drive (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Character & Drive / Drive` | range | 0–16383 = 0…100% | 0/1 |
| `Character & Drive / Character` | range | 0–16383 = 0…100% | 0/2 |

### DCO (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `DCO / Wave 1` | enum | Saw / Pulse / Saw R / Pulse R / None | 1/0 |
| `DCO / Wave 2` | enum | Saw / Pulse / Saw R / Pulse R / None | 1/1 |
| `DCO / PW 1` | range | 0–16383 = 0…100% | 1/2 |
| `DCO / PW 2` | range | 0–16383 = 0…100% | 1/3 |
| `DCO / Tune 2` | range | 0–16383 = -24…24 semitones (8192 = centre/0) | 1/4 |
| `DCO / Stack` | int | 1–8 | 1/5 |
| `DCO / Detune` | range | 0–16383 = 0…100% | 1/6 |
| `DCO / Balance` | range | 0–16383 = 0…100% | 1/7 |
| `DCO / Noise` | range | 0–16383 = 0…100% | 1/8 |

### VCF (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `VCF / Cutoff` | range | 0–16383 = 0…100% | 2/0 |
| `VCF / Resonance` | range | 0–16383 = 0…100% | 2/1 |
| `VCF / Env Amt` | range | 0–16383 = -100…100% (8192 = centre/0) | 2/2 |
| `VCF / Mode` | range | 0–16383 = 0…100% | 2/3 |
| `VCF / Key Follow` | range | 0–16383 = 0…100% | 2/4 |
| `VCF / Vel > VCF Env` | range | 0–16383 = 0…100% | 2/5 |
| `VCF / Engine` | enum | Classic / Mirror Twins | 2/6 |

### Mirror Twins (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Mirror Twins / Separation` | range | 0–16383 = 0…100% | 30/0 |
| `Mirror Twins / Depth` | range | 0–16383 = 0…100% | 30/1 |
| `Mirror Twins / Twin` | enum | Good / Evil | 30/2 |

### Amp (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Amp / Drone` | range | 0–16383 = 0…100% | 3/0 |
| `Amp / Pan` | range | 0–16383 = -100…100% (8192 = centre/0) | 3/1 |
| `Amp / Vel > Amp` | range | 0–16383 = 0…100% | 3/2 |
| `Amp / Env Amt` | range | 0–16383 = 0…100% | 3/3 |

### Perform (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Perform / Pitch` | range | 0–16383 = -24…24 semitones (8192 = centre/0) | 4/0 |
| `Perform / Glide` | range | 0–16383 = 0…100% | 4/1 |
| `Perform / Glide Mode` | enum | Normal / Legato | 4/2 |

### Parts (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Parts / Volume` | range | 0–16383 = 0…100% | 6/0 |
| `Parts / Poly` | int | 1–6 | 6/1 |
| `Parts / Unison` | int | 1–6 (1 = Off) | 6/2 |
| `Parts / Spread` | range | 0–16383 = 0…100% | 6/3 |
| `Parts / Para` | int | 1–5 (1 = Off) | 6/4 |
| `Parts / Trigger` | enum | Legato / Retrig | 6/5 |
| `Parts / Enabled` | enum | Off / On | 6/6 |
| `Parts / Output` | enum | Main / Aux1 / Aux2 / MainL / MainR / Aux1L / Aux1R / Aux2L / Aux2R | 6/7 |
| `Parts / Voices` | enum | Dynamic / Reserve | 6/8 |

### Key & Wheel (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Key & Wheel / Key > DCO` | range | 0–16383 = -400…400% (8192 = centre/0) | 11/0 |
| `Key & Wheel / Lowest Key` | int | 0–127 | 11/1 |
| `Key & Wheel / Highest Key` | int | 0–127 | 11/2 |
| `Key & Wheel / PB Up` | int | 0–24 | 14/0 |
| `Key & Wheel / PB Down` | int | 0–24 | 14/1 |

### Amp Env (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Amp Env / Attack` | range | 0–16383 = 0…100% | 19/0 |
| `Amp Env / Decay` | range | 0–16383 = 0…100% | 19/1 |
| `Amp Env / Sustain` | range | 0–16383 = 0…100% | 19/2 |
| `Amp Env / Release` | range | 0–16383 = 0…100% | 19/3 |
| `Amp Env / Reset` | enum | Off / On | 19/4 |

### VCF Env (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `VCF Env / Attack` | range | 0–16383 = 0…100% | 20/0 |
| `VCF Env / Decay` | range | 0–16383 = 0…100% | 20/1 |
| `VCF Env / Sustain` | range | 0–16383 = 0…100% | 20/2 |
| `VCF Env / Release` | range | 0–16383 = 0…100% | 20/3 |
| `VCF Env / Reset` | enum | Off / On | 20/4 |

### DCO Env (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `DCO Env / Attack` | range | 0–16383 = 0…100% | 21/0 |
| `DCO Env / Decay` | range | 0–16383 = 0…100% | 21/1 |
| `DCO Env / Sustain` | range | 0–16383 = 0…100% | 21/2 |
| `DCO Env / Release` | range | 0–16383 = 0…100% | 21/3 |
| `DCO Env / Reset` | enum | Off / On | 21/4 |

### Aux Env (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Aux Env / Attack` | range | 0–16383 = 0…100% | 22/0 |
| `Aux Env / Decay` | range | 0–16383 = 0…100% | 22/1 |
| `Aux Env / Sustain` | range | 0–16383 = 0…100% | 22/2 |
| `Aux Env / Release` | range | 0–16383 = 0…100% | 22/3 |
| `Aux Env / Reset` | enum | Off / On | 22/4 |

### LFO 1 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `LFO 1 / Rate` | range | 0–16383 = 0…100% | 23/0 |
| `LFO 1 / Clock Div` | enum | 8/1 / 4/1 / 2/1 / 1/1 / 1/2 / 1/4. / 1/2t / 1/4 / 1/8. / 1/4t / 1/8 / 1/16. / 1/8t / 1/16 / 1/32. / 1/16t / 1/32 / 1/64. / 1/32t / 1/64 | 23/1 |
| `LFO 1 / Wave` | enum | Tri / Sqr / Sin / Saw / RevSaw / Exp / RevExp / Log / RevLog / S&H | 23/2 |
| `LFO 1 / Sync` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 / Clock | 23/3 |
| `LFO 1 / Phase` | range | 0–16383 = 0…360 degrees | 23/4 |

### LFO 2 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `LFO 2 / Rate` | range | 0–16383 = 0…100% | 24/0 |
| `LFO 2 / Clock Div` | enum | 8/1 / 4/1 / 2/1 / 1/1 / 1/2 / 1/4. / 1/2t / 1/4 / 1/8. / 1/4t / 1/8 / 1/16. / 1/8t / 1/16 / 1/32. / 1/16t / 1/32 / 1/64. / 1/32t / 1/64 | 24/1 |
| `LFO 2 / Wave` | enum | Tri / Sqr / Sin / Saw / RevSaw / Exp / RevExp / Log / RevLog / S&H | 24/2 |
| `LFO 2 / Sync` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 / Clock | 24/3 |
| `LFO 2 / Phase` | range | 0–16383 = 0…360 degrees | 24/4 |

### LFO 3 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `LFO 3 / Rate` | range | 0–16383 = 0…100% | 25/0 |
| `LFO 3 / Clock Div` | enum | 8/1 / 4/1 / 2/1 / 1/1 / 1/2 / 1/4. / 1/2t / 1/4 / 1/8. / 1/4t / 1/8 / 1/16. / 1/8t / 1/16 / 1/32. / 1/16t / 1/32 / 1/64. / 1/32t / 1/64 | 25/1 |
| `LFO 3 / Wave` | enum | Tri / Sqr / Sin / Saw / RevSaw / Exp / RevExp / Log / RevLog / S&H | 25/2 |
| `LFO 3 / Sync` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 / Clock | 25/3 |
| `LFO 3 / Phase` | range | 0–16383 = 0…360 degrees | 25/4 |

### LFO 4 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `LFO 4 / Rate` | range | 0–16383 = 0…100% | 26/0 |
| `LFO 4 / Clock Div` | enum | 8/1 / 4/1 / 2/1 / 1/1 / 1/2 / 1/4. / 1/2t / 1/4 / 1/8. / 1/4t / 1/8 / 1/16. / 1/8t / 1/16 / 1/32. / 1/16t / 1/32 / 1/64. / 1/32t / 1/64 | 26/1 |
| `LFO 4 / Wave` | enum | Tri / Sqr / Sin / Saw / RevSaw / Exp / RevExp / Log / RevLog / S&H | 26/2 |
| `LFO 4 / Sync` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 / Clock | 26/3 |
| `LFO 4 / Phase` | range | 0–16383 = 0…360 degrees | 26/4 |

### Arp / Seq (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Arp / Seq / Seq Enabled` | enum | Off / On | 27/0 |
| `Arp / Seq / Engine` | enum | Classic Arp / Poly Seq | 27/1 |
| `Arp / Seq / Arp Rate` | enum | 8/1 / 4/1 / 2/1 / 1/1 / 1/2 / 1/4. / 1/2t / 1/4 / 1/8. / 1/4t / 1/8 / 1/16. / 1/8t / 1/16 / 1/32. / 1/16t / 1/32 / 1/64. / 1/32t / 1/64 | 28/0 |
| `Arp / Seq / Arp Gate` | range | 0–16383 = 0…100% | 28/1 |
| `Arp / Seq / Arp Mode` | enum | Up / Down / UpDown / UpDown2 / Played / Random | 28/2 |
| `Arp / Seq / Arp Octaves` | int | 1–4 | 28/3 |
| `Arp / Seq / Arp Sync` | enum | Note / Clock | 28/4 |
| `Arp / Seq / Seq Step` | enum | 1/128 / 1/64 / 1/32 / 1/16t / 1/32. / 1/16 / 1/8t / 1/16. / 1/8 / 1/4t / 1/8. / 1/4 / 1/2t / 1/4. / 1/2 / 1/1 | 29/0 |
| `Arp / Seq / Seq Steps` | int | 1–32 | 29/1 |

### Math 1 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Math 1 / Engine` | enum | SLEW / CURVE / FOLD & CLIP / QUANTIZE / MULTI-VIA / SAMPLE & HOLD / TRACK & HOLD / SWITCH / CROSSFADE | 36/0 |
| `Math 1 / Src Gain` | range | 0–16383 = -200…200% (8192 = centre/0) | 36/1 |
| `Math 1 / Src Bias` | range | 0–16383 = -100…100% (8192 = centre/0) | 36/2 |
| `Math 1 / Trigger` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 | 36/3 |
| `Math 1 / Control` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/4 |
| `Math 1 / Source 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/5 |
| `Math 1 / Source 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/6 |
| `Math 1 / Source 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/7 |
| `Math 1 / Source 4` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/8 |
| `Math 1 / Rise` | range | 0–16383 = 0…100% | 36/40 |
| `Math 1 / Fall` | range | 0–16383 = 0…100% | 36/41 |
| `Math 1 / Split` | range | 0–16383 = -100…100% (8192 = centre/0) | 36/48 |
| `Math 1 / Shelf` | range | 0–16383 = 0…100% | 36/49 |
| `Math 1 / Curve Lo` | range | 0–16383 = -100…100% (8192 = centre/0) | 36/50 |
| `Math 1 / Curve Hi` | range | 0–16383 = -100…100% (8192 = centre/0) | 36/51 |
| `Math 1 / Min` | range | 0–16383 = -100…0% (8192 = centre/0) | 36/56 |
| `Math 1 / Max` | range | 0–16383 = 0…100% | 36/57 |
| `Math 1 / Min Op` | enum | Clip / Fold | 36/58 |
| `Math 1 / Max Op` | enum | Clip / Fold | 36/59 |
| `Math 1 / Quant` | range | 0–16383 = 0…100% | 36/64 |
| `Math 1 / Via 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/72 |
| `Math 1 / Via 1 Amt` | range | 0–16383 = 0…100% | 36/73 |
| `Math 1 / Via 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/74 |
| `Math 1 / Via 2 Amt` | range | 0–16383 = 0…100% | 36/75 |
| `Math 1 / Via 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 36/76 |
| `Math 1 / Via 3 Amt` | range | 0–16383 = 0…100% | 36/77 |
| `Math 1 / Thresh` | range | 0–16383 = -100…100% (8192 = centre/0) | 36/80 |
| `Math 1 / Active` | enum | Low / High | 36/81 |
| `Math 1 / Xfade` | enum | On / Off | 36/88 |

### Math 2 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Math 2 / Engine` | enum | SLEW / CURVE / FOLD & CLIP / QUANTIZE / MULTI-VIA / SAMPLE & HOLD / TRACK & HOLD / SWITCH / CROSSFADE | 37/0 |
| `Math 2 / Src Gain` | range | 0–16383 = -200…200% (8192 = centre/0) | 37/1 |
| `Math 2 / Src Bias` | range | 0–16383 = -100…100% (8192 = centre/0) | 37/2 |
| `Math 2 / Trigger` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 | 37/3 |
| `Math 2 / Control` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/4 |
| `Math 2 / Source 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/5 |
| `Math 2 / Source 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/6 |
| `Math 2 / Source 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/7 |
| `Math 2 / Source 4` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/8 |
| `Math 2 / Rise` | range | 0–16383 = 0…100% | 37/40 |
| `Math 2 / Fall` | range | 0–16383 = 0…100% | 37/41 |
| `Math 2 / Split` | range | 0–16383 = -100…100% (8192 = centre/0) | 37/48 |
| `Math 2 / Shelf` | range | 0–16383 = 0…100% | 37/49 |
| `Math 2 / Curve Lo` | range | 0–16383 = -100…100% (8192 = centre/0) | 37/50 |
| `Math 2 / Curve Hi` | range | 0–16383 = -100…100% (8192 = centre/0) | 37/51 |
| `Math 2 / Min` | range | 0–16383 = -100…0% (8192 = centre/0) | 37/56 |
| `Math 2 / Max` | range | 0–16383 = 0…100% | 37/57 |
| `Math 2 / Min Op` | enum | Clip / Fold | 37/58 |
| `Math 2 / Max Op` | enum | Clip / Fold | 37/59 |
| `Math 2 / Quant` | range | 0–16383 = 0…100% | 37/64 |
| `Math 2 / Via 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/72 |
| `Math 2 / Via 1 Amt` | range | 0–16383 = 0…100% | 37/73 |
| `Math 2 / Via 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/74 |
| `Math 2 / Via 2 Amt` | range | 0–16383 = 0…100% | 37/75 |
| `Math 2 / Via 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 37/76 |
| `Math 2 / Via 3 Amt` | range | 0–16383 = 0…100% | 37/77 |
| `Math 2 / Thresh` | range | 0–16383 = -100…100% (8192 = centre/0) | 37/80 |
| `Math 2 / Active` | enum | Low / High | 37/81 |
| `Math 2 / Xfade` | enum | On / Off | 37/88 |

### Math 3 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Math 3 / Engine` | enum | SLEW / CURVE / FOLD & CLIP / QUANTIZE / MULTI-VIA / SAMPLE & HOLD / TRACK & HOLD / SWITCH / CROSSFADE | 38/0 |
| `Math 3 / Src Gain` | range | 0–16383 = -200…200% (8192 = centre/0) | 38/1 |
| `Math 3 / Src Bias` | range | 0–16383 = -100…100% (8192 = centre/0) | 38/2 |
| `Math 3 / Trigger` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 | 38/3 |
| `Math 3 / Control` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/4 |
| `Math 3 / Source 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/5 |
| `Math 3 / Source 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/6 |
| `Math 3 / Source 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/7 |
| `Math 3 / Source 4` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/8 |
| `Math 3 / Rise` | range | 0–16383 = 0…100% | 38/40 |
| `Math 3 / Fall` | range | 0–16383 = 0…100% | 38/41 |
| `Math 3 / Split` | range | 0–16383 = -100…100% (8192 = centre/0) | 38/48 |
| `Math 3 / Shelf` | range | 0–16383 = 0…100% | 38/49 |
| `Math 3 / Curve Lo` | range | 0–16383 = -100…100% (8192 = centre/0) | 38/50 |
| `Math 3 / Curve Hi` | range | 0–16383 = -100…100% (8192 = centre/0) | 38/51 |
| `Math 3 / Min` | range | 0–16383 = -100…0% (8192 = centre/0) | 38/56 |
| `Math 3 / Max` | range | 0–16383 = 0…100% | 38/57 |
| `Math 3 / Min Op` | enum | Clip / Fold | 38/58 |
| `Math 3 / Max Op` | enum | Clip / Fold | 38/59 |
| `Math 3 / Quant` | range | 0–16383 = 0…100% | 38/64 |
| `Math 3 / Via 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/72 |
| `Math 3 / Via 1 Amt` | range | 0–16383 = 0…100% | 38/73 |
| `Math 3 / Via 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/74 |
| `Math 3 / Via 2 Amt` | range | 0–16383 = 0…100% | 38/75 |
| `Math 3 / Via 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 38/76 |
| `Math 3 / Via 3 Amt` | range | 0–16383 = 0…100% | 38/77 |
| `Math 3 / Thresh` | range | 0–16383 = -100…100% (8192 = centre/0) | 38/80 |
| `Math 3 / Active` | enum | Low / High | 38/81 |
| `Math 3 / Xfade` | enum | On / Off | 38/88 |

### Math 4 (part)

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Math 4 / Engine` | enum | SLEW / CURVE / FOLD & CLIP / QUANTIZE / MULTI-VIA / SAMPLE & HOLD / TRACK & HOLD / SWITCH / CROSSFADE | 39/0 |
| `Math 4 / Src Gain` | range | 0–16383 = -200…200% (8192 = centre/0) | 39/1 |
| `Math 4 / Src Bias` | range | 0–16383 = -100…100% (8192 = centre/0) | 39/2 |
| `Math 4 / Trigger` | enum | None / NoteOn / NoteOnPt / NoteOff / NteOffPt / LFO1 / LFO2 / LFO3 / LFO4 | 39/3 |
| `Math 4 / Control` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/4 |
| `Math 4 / Source 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/5 |
| `Math 4 / Source 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/6 |
| `Math 4 / Source 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/7 |
| `Math 4 / Source 4` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/8 |
| `Math 4 / Rise` | range | 0–16383 = 0…100% | 39/40 |
| `Math 4 / Fall` | range | 0–16383 = 0…100% | 39/41 |
| `Math 4 / Split` | range | 0–16383 = -100…100% (8192 = centre/0) | 39/48 |
| `Math 4 / Shelf` | range | 0–16383 = 0…100% | 39/49 |
| `Math 4 / Curve Lo` | range | 0–16383 = -100…100% (8192 = centre/0) | 39/50 |
| `Math 4 / Curve Hi` | range | 0–16383 = -100…100% (8192 = centre/0) | 39/51 |
| `Math 4 / Min` | range | 0–16383 = -100…0% (8192 = centre/0) | 39/56 |
| `Math 4 / Max` | range | 0–16383 = 0…100% | 39/57 |
| `Math 4 / Min Op` | enum | Clip / Fold | 39/58 |
| `Math 4 / Max Op` | enum | Clip / Fold | 39/59 |
| `Math 4 / Quant` | range | 0–16383 = 0…100% | 39/64 |
| `Math 4 / Via 1` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/72 |
| `Math 4 / Via 1 Amt` | range | 0–16383 = 0…100% | 39/73 |
| `Math 4 / Via 2` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/74 |
| `Math 4 / Via 2 Amt` | range | 0–16383 = 0…100% | 39/75 |
| `Math 4 / Via 3` | enum | Off / DCO Env / VCF Env / Amp Env / Aux Env / LFO 1 / LFO 2 / LFO 3 / LFO 4 / Vel / Off Vel / AT / Key / Gate / ModWheel / PB / VoiceIdx / VoiceAlt / VoiceRnd / Uni Idx / Uni Alt / Poly Idx / Poly Alt / Note Rnd / CC74 / ArpSeq / Macro 1 / Macro 2 / Macro 3 / Macro 4 / Macro 5 / Macro 6 / Macro 7 / Macro 8 / Math 1 / Math 2 / Math 3 / Math 4 | 39/76 |
| `Math 4 / Via 3 Amt` | range | 0–16383 = 0…100% | 39/77 |
| `Math 4 / Thresh` | range | 0–16383 = -100…100% (8192 = centre/0) | 39/80 |
| `Math 4 / Active` | enum | Low / High | 39/81 |
| `Math 4 / Xfade` | enum | On / Off | 39/88 |

### FX (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `FX / FX On` | enum | Off / On | 8/0 |
| `FX / FX Engine` | enum | Stage Reverb / X-Delay / Vintage Chorus / Chorus+ | 8/1 |

### Clock (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Clock / BPM` | int | 100–2500 (value ÷ 10 = BPM) | 10/0 |

### Stage Reverb (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Stage Reverb / Decay` | range | 0–16383 = 0…100% | 31/0 |
| `Stage Reverb / Level` | range | 0–16383 = 0…100% | 31/1 |
| `Stage Reverb / Damping` | range | 0–16383 = 0…100% | 31/2 |
| `Stage Reverb / Hi Cut` | range | 0–16383 = 0…100% | 31/3 |
| `Stage Reverb / Lo Cut` | range | 0–16383 = 0…100% | 31/4 |
| `Stage Reverb / Predelay` | range | 0–16383 = 0…100% | 31/5 |
| `Stage Reverb / Stage` | enum | Shower / Club / Arena / Canyon / Cosmos | 31/6 |
| `Stage Reverb / Chorus` | enum | Off / I / II / I+II | 31/7 |

### Vintage Chorus (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Vintage Chorus / Mode` | enum | Off / I / II / I+II | 32/0 |
| `Vintage Chorus / Level` | range | 0–16383 = 0…100% | 32/1 |

### Chorus+ (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Chorus+ / Mix` | range | 0–16383 = 0…100% | 33/0 |
| `Chorus+ / Delay` | range | 0–16383 = 0…100% | 33/1 |
| `Chorus+ / Depth` | range | 0–16383 = 0…100% | 33/2 |
| `Chorus+ / Rate` | range | 0–16383 = 0…100% | 33/3 |
| `Chorus+ / Feedback` | range | 0–16383 = 0…100% | 33/4 |
| `Chorus+ / Tone` | range | 0–16383 = 0…100% | 33/5 |
| `Chorus+ / Mode` | enum | SqrWide / SinWide / Sqr / Sin | 33/6 |

### X-Delay (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `X-Delay / Time` | range | 0–16383 = 0…100% | 34/0 |
| `X-Delay / BPM Div` | enum | 1/32 / 1/16t / 1/32. / 1/16 / 1/8t / 1/16. / 1/8 / 1/4t / 1/8. / 1/4 / 1/2t / 1/4. / 1/2 | 34/1 |
| `X-Delay / Level` | range | 0–16383 = 0…100% | 34/2 |
| `X-Delay / Feedback` | range | 0–16383 = 0…100% | 34/3 |
| `X-Delay / Sync` | enum | Off / On | 34/4 |
| `X-Delay / X-Pan` | range | 0–16383 = -100…100% (8192 = centre/0) | 34/5 |
| `X-Delay / Offset` | range | 0–16383 = -50…50% (8192 = centre/0) | 34/6 |
| `X-Delay / Damping` | range | 0–16383 = 0…100% | 34/7 |
| `X-Delay / Chorus` | enum | Off / I / II / I+II | 34/8 |

### Macros (global (Perform channel))

| Key in patch file | Kind | Values | NRPN |
|---|---|---|---|
| `Macros / Macro 1` | range | 0–16383 = 0…100% | 35/0 |
| `Macros / Macro 2` | range | 0–16383 = 0…100% | 35/1 |
| `Macros / Macro 3` | range | 0–16383 = 0…100% | 35/2 |
| `Macros / Macro 4` | range | 0–16383 = 0…100% | 35/3 |
| `Macros / Macro 5` | range | 0–16383 = 0…100% | 35/4 |
| `Macros / Macro 6` | range | 0–16383 = 0…100% | 35/5 |
| `Macros / Macro 7` | range | 0–16383 = 0…100% | 35/6 |
| `Macros / Macro 8` | range | 0–16383 = 0…100% | 35/7 |
