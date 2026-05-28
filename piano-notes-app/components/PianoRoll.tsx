'use client'

import { useMemo } from 'react'
import type { MidiData } from '@/lib/midi-loader'
import type { NoteSystem } from '@/lib/note-names'
import { getMidiNoteName, getMidiNoteNameWithOctave } from '@/lib/note-names'

const ROW_H    = 12   // px per semitone
const PX_PER_SEC = 80 // horizontal scale
const KEY_W    = 54   // piano keyboard strip width
const HEADER_H = 22   // time ruler height
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])  // pitch classes that are black keys

interface Props {
  midiData: MidiData
  noteSystem: NoteSystem
  labelColor: string
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function PianoRoll({ midiData, noteSystem, labelColor }: Props) {
  const { notes, durationSeconds, tracks, bpm } = midiData

  // Pitch range present in the file
  const { minMidi, maxMidi } = useMemo(() => {
    if (notes.length === 0) return { minMidi: 48, maxMidi: 84 }
    let min = 127, max = 0
    for (const n of notes) {
      if (n.midi < min) min = n.midi
      if (n.midi > max) max = n.midi
    }
    return { minMidi: Math.max(0, min - 2), maxMidi: Math.min(127, max + 2) }
  }, [notes])

  const pitchRange  = maxMidi - minMidi + 1
  const rollH       = pitchRange * ROW_H
  const rollW       = Math.max(Math.ceil(durationSeconds) * PX_PER_SEC, 600)
  const multiTrack  = tracks.length > 1

  function pitchToY(midi: number): number {
    return (maxMidi - midi) * ROW_H
  }

  // Time markers — step depends on piece length
  const timeMarkers = useMemo(() => {
    const step = durationSeconds > 180 ? 30 : durationSeconds > 90 ? 15 : 10
    const markers: number[] = []
    for (let t = 0; t <= durationSeconds; t += step) markers.push(t)
    return markers
  }, [durationSeconds])

  // MIDI pitches in range that are C (show on keyboard and as grid lines)
  const cPitches = useMemo(() => {
    const out: number[] = []
    for (let m = minMidi; m <= maxMidi; m++) {
      if (m % 12 === 0) out.push(m)
    }
    return out
  }, [minMidi, maxMidi])

  return (
    <div>
      {/* Info + print bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 print:hidden">
        <span className="text-sm text-gray-400">{notes.length} notes</span>
        <span className="text-gray-700">·</span>
        <span className="text-sm text-gray-400">{fmtTime(durationSeconds)}</span>
        <span className="text-gray-700">·</span>
        <span className="text-sm text-gray-400">{bpm} BPM</span>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Track legend */}
      {multiTrack && (
        <div className="flex flex-wrap gap-3 mb-3 print:hidden">
          {tracks.map((t) => (
            <div key={t.index} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
              {t.name}
            </div>
          ))}
        </div>
      )}

      {/* Piano roll */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700 bg-gray-950">

        {/* Fixed keyboard strip */}
        <div className="flex-shrink-0 bg-gray-900 border-r border-gray-700">
          {/* spacer aligns with time ruler */}
          <div style={{ height: HEADER_H, borderBottom: '1px solid #1f2937' }} />
          <svg width={KEY_W} height={rollH} style={{ display: 'block' }}>
            {Array.from({ length: pitchRange }, (_, i) => {
              const midi  = maxMidi - i
              const pc    = midi % 12
              const isBlack = BLACK_KEYS.has(pc)
              const isC   = pc === 0
              const y     = i * ROW_H
              return (
                <g key={midi}>
                  <rect
                    x={0} y={y} width={KEY_W} height={ROW_H}
                    fill={isBlack ? '#1f2937' : '#f1f5f9'}
                    stroke="#374151" strokeWidth={0.5}
                  />
                  {isC && (
                    <text
                      x={KEY_W - 4} y={y + ROW_H - 2}
                      textAnchor="end"
                      fontSize={7.5}
                      fontFamily="Arial, Helvetica, sans-serif"
                      fontWeight="bold"
                      fill="#374151"
                    >
                      {getMidiNoteNameWithOctave(midi, noteSystem)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Scrollable roll */}
        <div className="flex-1 overflow-x-auto">
          <svg
            width={rollW}
            height={rollH + HEADER_H}
            style={{ display: 'block', minWidth: rollW }}
          >
            {/* Background pitch rows */}
            {Array.from({ length: pitchRange }, (_, i) => {
              const midi    = maxMidi - i
              const isBlack = BLACK_KEYS.has(midi % 12)
              return (
                <rect
                  key={midi}
                  x={0} y={HEADER_H + i * ROW_H}
                  width={rollW} height={ROW_H}
                  fill={isBlack ? '#1e293b' : '#0f172a'}
                />
              )
            })}

            {/* C guide lines */}
            {cPitches.map((midi) => (
              <line
                key={midi}
                x1={0} y1={HEADER_H + pitchToY(midi)}
                x2={rollW} y2={HEADER_H + pitchToY(midi)}
                stroke="#334155" strokeWidth={1} strokeDasharray="4 3"
              />
            ))}

            {/* Vertical time grid */}
            {timeMarkers.map((t) => (
              <line
                key={t}
                x1={t * PX_PER_SEC} y1={HEADER_H}
                x2={t * PX_PER_SEC} y2={rollH + HEADER_H}
                stroke="#1f2937" strokeWidth={1}
              />
            ))}

            {/* Time ruler */}
            <rect x={0} y={0} width={rollW} height={HEADER_H} fill="#111827" />
            {timeMarkers.map((t) => (
              <g key={t}>
                <line
                  x1={t * PX_PER_SEC} y1={0}
                  x2={t * PX_PER_SEC} y2={HEADER_H}
                  stroke="#374151" strokeWidth={1}
                />
                <text
                  x={t * PX_PER_SEC + 3} y={HEADER_H - 5}
                  fontSize={8} fontFamily="Arial, Helvetica, sans-serif" fill="#6b7280"
                >
                  {fmtTime(t)}
                </text>
              </g>
            ))}

            {/* Notes */}
            {notes.map((note, i) => {
              const x     = note.time * PX_PER_SEC
              const y     = HEADER_H + pitchToY(note.midi)
              const w     = Math.max(2, note.duration * PX_PER_SEC)
              const color = multiTrack
                ? (tracks[note.trackIndex]?.color ?? '#6366f1')
                : labelColor
              const name  = getMidiNoteName(note.midi, noteSystem)
              const showLabel = w >= 16

              return (
                <g key={i}>
                  <rect
                    x={x} y={y + 1} width={w} height={ROW_H - 2}
                    rx={1.5} ry={1.5}
                    fill={color}
                    opacity={0.45 + note.velocity * 0.55}
                  />
                  {showLabel && (
                    <text
                      x={x + 2} y={y + ROW_H - 3}
                      fontSize={7}
                      fontFamily="Arial, Helvetica, sans-serif"
                      fontWeight="bold"
                      fill="white"
                    >
                      {name}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
