'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import type { MidiData } from '@/lib/midi-loader'
import type { NoteSystem } from '@/lib/note-names'
import { getMidiNoteName, getMidiNoteNameWithOctave } from '@/lib/note-names'

const ROW_H      = 12
const PX_PER_SEC = 80
const KEY_W      = 54
const HEADER_H   = 22
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])

interface Props {
  midiData: MidiData
  noteSystem: NoteSystem
  labelColor: string
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function PianoRoll({ midiData, noteSystem, labelColor }: Props) {
  const { notes, durationSeconds, tracks, bpm } = midiData

  const [playing, setPlaying]   = useState(false)
  const [elapsed,  setElapsed]  = useState(0)

  // DOM refs — updated directly in rAF loop to avoid re-renders
  const scrollRef   = useRef<HTMLDivElement>(null)

  // Tone.js refs
  const toneRef  = useRef<typeof import('tone') | null>(null)
  const synthRef = useRef<any>(null)
  const partRef  = useRef<any>(null)
  const rafRef   = useRef<number | undefined>(undefined)

  // ── Pitch range ────────────────────────────────────────────────────────────
  const { minMidi, maxMidi } = useMemo(() => {
    if (notes.length === 0) return { minMidi: 48, maxMidi: 84 }
    let min = 127, max = 0
    for (const n of notes) {
      if (n.midi < min) min = n.midi
      if (n.midi > max) max = n.midi
    }
    return { minMidi: Math.max(0, min - 2), maxMidi: Math.min(127, max + 2) }
  }, [notes])

  const pitchRange = maxMidi - minMidi + 1
  const rollH      = pitchRange * ROW_H
  const rollW      = Math.max(Math.ceil(durationSeconds) * PX_PER_SEC, 600)
  const multiTrack = tracks.length > 1

  function pitchToY(midi: number) { return (maxMidi - midi) * ROW_H }

  const timeMarkers = useMemo(() => {
    const step = durationSeconds > 180 ? 30 : durationSeconds > 90 ? 15 : 10
    const out: number[] = []
    for (let t = 0; t <= durationSeconds; t += step) out.push(t)
    return out
  }, [durationSeconds])

  const cPitches = useMemo(() => {
    const out: number[] = []
    for (let m = minMidi; m <= maxMidi; m++) if (m % 12 === 0) out.push(m)
    return out
  }, [minMidi, maxMidi])

  // ── rAF tick — drives auto-scroll ─────────────────────────────────────────
  const tick = useCallback(() => {
    const Tone = toneRef.current
    if (!Tone) return

    const transportT = Tone.Transport.seconds
    // Subtract look-ahead so the keyboard edge matches what's audible right now
    const lookAhead  = (Tone as any).getContext?.()?.lookAhead ?? 0.1
    const visualT    = Math.max(0, transportT - lookAhead)
    const x          = visualT * PX_PER_SEC

    // Scroll so the current audible moment is right at the left edge
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, x)
    }

    setElapsed(transportT)

    // Keep running for 2s after the music ends so last notes scroll past keyboard
    if (transportT < durationSeconds + 2) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      stopPlayback(true)
    }
  }, [durationSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal stop helper ───────────────────────────────────────────────────
  const stopPlayback = useCallback((finished = false) => {
    cancelAnimationFrame(rafRef.current!)
    const Tone = toneRef.current
    if (Tone) {
      Tone.Transport.stop()
      Tone.Transport.cancel()
    }
    partRef.current?.dispose()
    partRef.current = null

    if (!finished && scrollRef.current) scrollRef.current.scrollLeft = 0

    setPlaying(false)
    setElapsed(0)
  }, [])

  // ── Controls ───────────────────────────────────────────────────────────────
  async function handlePlay() {
    // Lazy-load Tone.js (client-only)
    if (!toneRef.current) {
      toneRef.current = await import('tone')
    }
    const Tone = toneRef.current

    await Tone.start()

    // Resume if paused
    const transport = Tone.Transport
    if (transport.state === 'paused') {
      transport.start()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    // Fresh start — create synth + schedule all notes
    synthRef.current?.dispose()
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' as any },
      envelope: { attack: 0.02, decay: 3, sustain: 0, release: 1 },
      volume: -8,
    }).toDestination()

    const events = notes.map(n => ({ time: n.time, midi: n.midi, duration: n.duration, velocity: n.velocity }))

    partRef.current = new Tone.Part(
      (time: number, ev: { midi: number; duration: number; velocity: number }) => {
        const freq = Tone.Frequency(ev.midi, 'midi').toFrequency()
        synthRef.current?.triggerAttackRelease(freq, ev.duration, time, ev.velocity)
      },
      events
    )
    partRef.current.start(0)

    transport.start()
    setPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }

  function handlePause() {
    toneRef.current?.getTransport().pause()
    cancelAnimationFrame(rafRef.current!)
    setPlaying(false)
  }

  function handleStop() { stopPlayback(false) }

  // ── Cleanup on unmount / file change ──────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current!)
      toneRef.current?.getTransport().stop()
      toneRef.current?.getTransport().cancel()
      synthRef.current?.dispose()
      partRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    stopPlayback(false)
  }, [midiData, stopPlayback])

  // ── Render ─────────────────────────────────────────────────────────────────
  const progress = durationSeconds > 0 ? Math.min(elapsed / durationSeconds, 1) : 0

  return (
    <div>
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 print:hidden text-sm text-gray-400">
        <span>{notes.length} notes</span>
        <span className="text-gray-700">·</span>
        <span>{fmtTime(durationSeconds)}</span>
        <span className="text-gray-700">·</span>
        <span>{bpm} BPM</span>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
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

      {/* Transport controls */}
      <div className="flex items-center gap-3 mb-3 print:hidden">
        {/* Play / Pause */}
        <button
          onClick={playing ? handlePause : handlePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-white"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            // Pause icon
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1"/>
              <rect x="8" y="1" width="4" height="12" rx="1"/>
            </svg>
          ) : (
            // Play icon
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="2,1 13,7 2,13"/>
            </svg>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-white"
          title="Stop"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="0" y="0" width="10" height="10" rx="1"/>
          </svg>
        </button>

        {/* Progress bar + time */}
        <div className="flex-1 flex items-center gap-2">
          <div
            className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              const newTime = ratio * durationSeconds
              if (toneRef.current) {
                toneRef.current.getTransport().seconds = newTime
              }
            }}
          >
            <div
              className="h-full bg-indigo-500 rounded-full transition-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums w-16 text-right">
            {fmtTime(elapsed)} / {fmtTime(durationSeconds)}
          </span>
        </div>
      </div>

      {/* Piano roll */}
      <div className="flex rounded-xl overflow-hidden border border-gray-700 bg-gray-950">

        {/* Fixed keyboard strip */}
        <div className="flex-shrink-0 bg-gray-900 border-r border-gray-700">
          <div style={{ height: HEADER_H, borderBottom: '1px solid #1f2937' }} />
          <svg width={KEY_W} height={rollH} style={{ display: 'block' }}>
            {Array.from({ length: pitchRange }, (_, i) => {
              const midi    = maxMidi - i
              const pc      = midi % 12
              const isBlack = BLACK_KEYS.has(pc)
              const isC     = pc === 0
              const y       = i * ROW_H
              return (
                <g key={midi}>
                  <rect x={0} y={y} width={KEY_W} height={ROW_H}
                    fill={isBlack ? '#1f2937' : '#f1f5f9'}
                    stroke="#374151" strokeWidth={0.5}
                  />
                  {isC && (
                    <text x={KEY_W - 4} y={y + ROW_H - 2}
                      textAnchor="end" fontSize={7.5}
                      fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" fill="#374151"
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
        <div ref={scrollRef} className="flex-1 overflow-x-auto" style={{ scrollBehavior: 'auto' }}>
          <svg
            width={rollW} height={rollH + HEADER_H}
            style={{ display: 'block', minWidth: rollW }}
          >
            {/* Background pitch rows */}
            {Array.from({ length: pitchRange }, (_, i) => {
              const midi    = maxMidi - i
              const isBlack = BLACK_KEYS.has(midi % 12)
              return (
                <rect key={midi}
                  x={0} y={HEADER_H + i * ROW_H}
                  width={rollW} height={ROW_H}
                  fill={isBlack ? '#1e293b' : '#0f172a'}
                />
              )
            })}

            {/* C guide lines */}
            {cPitches.map((midi) => (
              <line key={midi}
                x1={0} y1={HEADER_H + pitchToY(midi)}
                x2={rollW} y2={HEADER_H + pitchToY(midi)}
                stroke="#334155" strokeWidth={1} strokeDasharray="4 3"
              />
            ))}

            {/* Vertical time grid */}
            {timeMarkers.map((t) => (
              <line key={t}
                x1={t * PX_PER_SEC} y1={HEADER_H}
                x2={t * PX_PER_SEC} y2={rollH + HEADER_H}
                stroke="#1f2937" strokeWidth={1}
              />
            ))}

            {/* Time ruler */}
            <rect x={0} y={0} width={rollW} height={HEADER_H} fill="#111827" />
            {timeMarkers.map((t) => (
              <g key={t}>
                <line x1={t * PX_PER_SEC} y1={0} x2={t * PX_PER_SEC} y2={HEADER_H}
                  stroke="#374151" strokeWidth={1}
                />
                <text x={t * PX_PER_SEC + 3} y={HEADER_H - 5}
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
              return (
                <g key={i}>
                  <rect x={x} y={y + 1} width={w} height={ROW_H - 2}
                    rx={1.5} ry={1.5}
                    fill={color}
                    opacity={0.45 + note.velocity * 0.55}
                  />
                  {w >= 16 && (
                    <text x={x + 2} y={y + ROW_H - 3}
                      fontSize={7} fontFamily="Arial, Helvetica, sans-serif"
                      fontWeight="bold" fill="white"
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
