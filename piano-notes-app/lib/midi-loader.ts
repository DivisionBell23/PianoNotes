import { Midi } from '@tonejs/midi'

export interface MidiNote {
  midi: number      // MIDI pitch 0–127
  time: number      // onset in seconds
  duration: number  // length in seconds
  velocity: number  // 0.0–1.0
  trackIndex: number
}

export interface MidiTrackMeta {
  index: number
  name: string
  color: string
}

export interface MidiData {
  fileName: string
  songName: string        // from MIDI header, or '' if not present
  durationSeconds: number
  bpm: number
  tracks: MidiTrackMeta[]
  notes: MidiNote[]
}

const TRACK_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
]

export async function loadMidi(file: File): Promise<MidiData> {
  const buffer = await file.arrayBuffer()
  const midi = new Midi(buffer)

  const tracks: MidiTrackMeta[] = []
  const notes: MidiNote[] = []
  let trackIdx = 0

  midi.tracks.forEach((track) => {
    if (track.notes.length === 0) return

    tracks.push({
      index: trackIdx,
      name: track.name || `Track ${trackIdx + 1}`,
      color: TRACK_COLORS[trackIdx % TRACK_COLORS.length],
    })

    track.notes.forEach((note) => {
      notes.push({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        trackIndex: trackIdx,
      })
    })

    trackIdx++
  })

  notes.sort((a, b) => a.time - b.time)

  const bpm = midi.header.tempos.length > 0
    ? Math.round(midi.header.tempos[0].bpm)
    : 120

  return {
    fileName: file.name,
    songName: midi.header.name ?? '',
    durationSeconds: midi.duration,
    bpm,
    tracks,
    notes,
  }
}
