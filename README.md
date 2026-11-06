# Rubra VI

*A sound design editor for the Supercritical Redshift 6.*

**Open it here: [silverphonic.github.io/rubra-vi](https://silverphonic.github.io/rubra-vi/)** — nothing to download or install.

Rubra VI programs the **Redshift 6** over MIDI: every MIDI-addressable parameter on one panel, a Modulation page that draws the patch as cables, a preview keyboard, and patch files you can save, load and share.

It works with Redshift 6 firmware 1.7. It is an independent project, not made by Supercritical Synthesizers.

## What you need

- **Google Chrome, Microsoft Edge or Opera** on a Mac, Windows PC or Chromebook. Safari can't use MIDI in web pages, and neither can any browser on iPhone or iPad. Firefox works after an extra permission prompt.
- Your Redshift 6 connected to the computer by MIDI: directly by USB, or through an interface or MIDI hub.

## First-time setup

1. Open the link above and click **Allow** when the browser asks to use MIDI devices.
2. **MIDI output:** pick the port your Redshift is connected through, in the menu at the top.
3. **Settings:** the MIDI channels must match the Redshift's own [SETTINGS] → MIDI Channels page (defaults: Perform 1, Parts 2–7, Groups A–C 8–10, MPE Mode Off). Settings shows them in the same order, warns about clashes, and has a **channel test** that plays a note on each part so you can watch the right part button blink. **Speed test…** in the Patch bar finds the fastest reliable message spacing for your setup.
4. **MIDI in** (on the preview keyboard): optionally choose a hardware keyboard to play through the app. Pick a port that doesn't also reach the Redshift directly, or notes will double.

If you clicked **Block** by mistake, click the icon at the left of the address bar and allow MIDI for this site, then reload.

## Using it

- **Part buttons 1–6** choose which part every control talks to.
- **Panel page:** every MIDI-addressable parameter. Drag knobs (Shift for fine steps), double-click to reset, or click a readout to type a value.
- **Modulation page:** sources, Math slots and destinations drawn as cables. Solid cables are set live over MIDI; dashed cables are routings you set **by hand** on the Redshift.
- **To-do window:** anything the Redshift can't take over MIDI (Mod Matrix routings, part Group) appears here as steps to do by hand. Tick each one off when done.
- **Patch bar:** Init part, Init all, Send part, Audition, Save patch…, Load patch… Patches are saved as files you can share.
- **Computer keyboard:** keys A–; play notes, Z/X change octave.
- **Reset a part on the Redshift itself?** Use **Settings → Forget** for that part (or all parts) so the app stops showing old values.
- **Remember to save presets on the Redshift itself** ([SHIFT] + [OK]); patch files can't store your by-hand routings on the synth.

## Designing sounds with an AI assistant

Give **[AI_SOUND_DESIGN_GUIDE.md](AI_SOUND_DESIGN_GUIDE.md)** to Claude or a similar assistant, describe the sound you want, and ask it to write a patch file. Load the file with **Load patch…** and follow the by-hand steps it lists.

## Good to know

- The app can't read settings back from the Redshift, so it shows what it has sent. Use **Init part** or load a patch to get the app and the synth in step.
- Your settings, part states and names are stored in your browser on that computer.
- It can share the MIDI port with Bitwig, Logic and other apps, but avoid controlling the same parameter from two places at once.

## Credits

© 2026 [Silverphonic SoundLab](https://www.silverphonic.com) · [info@silverphonic.com](mailto:info@silverphonic.com?subject=Rubra%20VI)

Fonts: Audiowide and Playfair Display, under the SIL Open Font License (see `fonts/`).
