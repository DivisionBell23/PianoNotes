# PianoNotes App — Project Objectives

## Overview
A mobile app that accepts PDF music sheets and helps piano students learn by:
1. Annotating the sheet with note names
2. Generating a video that visualizes the notes falling and highlights the corresponding piano keys

---

## POC — Web App (Next.js) ✅ COMPLETED

The POC skips PDF/OMR and uses **MusicXML (.mxl / .xml)** format, which contains structured note data.
Hosted on Vercel, CI/CD via GitHub.

### POC Features — all done ✅
- [x] Drag & drop upload of `.mxl`, `.xml`, `.musicxml` files
- [x] Render score with OpenSheetMusicDisplay (OSMD) → SVG, multi-page
- [x] Annotate every note with its name:
  - **English**: C, D, E, F, G, A, B (with # / ♭)
  - **French/Solfège**: Do, Ré, Mi, Fa, Sol, La, Si (with # / ♭)
- [x] Handle key signatures (fifths-based, applied when OSMD gives no accidental)
- [x] Labels positioned outside staff lines (above treble, below bass)
- [x] Chord de-overlap: stacked labels never cover each other
- [x] Label color picker: 5 presets + custom color input
- [x] Toggle between English / French note systems without re-rendering
- [x] Print / Save as PDF:
  - Correct pagination (treble + bass staff stay together, page breaks between systems)
  - Labels injected as SVG `<text>` elements so they scale correctly with the score
  - Color preserved in print; B&W-friendly outline fallback

---

## Feature 1: Music Sheet Annotation (PDF) — next phase
- User uploads a PDF containing a piano music sheet
- App performs Optical Music Recognition (OMR) to detect notes on the staff
- Annotates each note with its name (English or French/Solfège, including accidentals)
- Must handle key signatures
- Output: annotated PDF or overlay view

## Feature 2: Animated Video / Falling Notes — future
- Generate a "falling notes" video (Synthesia-style)
- Each note falls from the top and hits the correct key on a virtual piano keyboard
- Keys light up as notes are played
- Timing derived from note duration and tempo
- Output: exportable video (MP4 or similar)

---

## Platform
- **POC**: Web (Next.js, Vercel) ✅
- **Next**: Mobile-first iOS + Android (Expo / React Native wrapper around the web POC)

---

## Notes & Considerations
- Piano-specific for now; architecture should allow adding other instruments later
- Black keys (sharps/flats) must be clearly distinguishable from white keys
- Annotation must be readable and not clutter the original sheet
- OMR (Optical Music Recognition) is the core hard problem for PDF support — may require a cloud API

---

## Milestones
- [x] POC: MXL upload, OSMD render, note annotation (English + French), color picker, print/PDF export
- [ ] PDF support: OMR integration to detect notes from uploaded PDFs
- [ ] Feature 2: Synthesia-style falling notes video generation
- [ ] Mobile app wrapper (Expo / React Native)
- [ ] Polish & UX (settings, language, instrument selection)
