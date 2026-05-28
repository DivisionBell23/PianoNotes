export type NoteSystem = 'english' | 'french'

// Maps OSMD NoteEnum values to step letters
const NOTE_ENUM_TO_STEP: Record<number, string> = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
}

// OSMD AccidentalEnum values
const ACCIDENTAL = {
  SHARP: 0,
  FLAT: 1,
  NONE: 2,
  NATURAL: 3,
  DOUBLESHARP: 4,
  DOUBLEFLAT: 5,
}

const FRENCH: Record<string, string> = {
  C: 'Do',
  D: 'Ré',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

// ── MIDI pitch → note name ────────────────────────────────────────────────────

// Chromatic pitch class (0–11) → step + accidental using sharps for black keys
const MIDI_PITCH_CLASS: Array<{ step: string; acc: number }> = [
  { step: 'C', acc: 2 },  // 0  C
  { step: 'C', acc: 0 },  // 1  C#
  { step: 'D', acc: 2 },  // 2  D
  { step: 'D', acc: 0 },  // 3  D#
  { step: 'E', acc: 2 },  // 4  E
  { step: 'F', acc: 2 },  // 5  F
  { step: 'F', acc: 0 },  // 6  F#
  { step: 'G', acc: 2 },  // 7  G
  { step: 'G', acc: 0 },  // 8  G#
  { step: 'A', acc: 2 },  // 9  A
  { step: 'A', acc: 0 },  // 10 A#
  { step: 'B', acc: 2 },  // 11 B
]

const STEP_TO_ENUM: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** Convert a MIDI note number (0–127) to a display name in the given system. */
export function getMidiNoteName(midiNumber: number, system: NoteSystem): string {
  const { step, acc } = MIDI_PITCH_CLASS[midiNumber % 12]
  return getNoteName(STEP_TO_ENUM[step], acc, system)
}

/** Same as getMidiNoteName but appends the octave number (e.g. "C4", "Do4"). */
export function getMidiNoteNameWithOctave(midiNumber: number, system: NoteSystem): string {
  const octave = Math.floor(midiNumber / 12) - 1
  return getMidiNoteName(midiNumber, system) + octave
}

// ─────────────────────────────────────────────────────────────────────────────

export function getNoteName(
  fundamentalNote: number,  // NoteEnum value
  accidental: number,       // AccidentalEnum value
  system: NoteSystem
): string {
  const step = NOTE_ENUM_TO_STEP[fundamentalNote] ?? '?'
  const base = system === 'english' ? step : (FRENCH[step] ?? step)

  switch (accidental) {
    case ACCIDENTAL.SHARP:      return base + '♯'
    case ACCIDENTAL.FLAT:       return base + '♭'
    case ACCIDENTAL.DOUBLESHARP: return base + '𝄪'
    case ACCIDENTAL.DOUBLEFLAT:  return base + '𝄫'
    default:                    return base
  }
}
