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
