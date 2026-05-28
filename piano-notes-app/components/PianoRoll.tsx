'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import type { MidiData } from '@/lib/midi-loader'
import type { NoteSystem } from '@/lib/note-names'
import { getMidiNoteName, getMidiNoteNameWithOctave } from '@/lib/note-names'

// ── Layout constants ──────────────────────────────────────────────────────────
const MIN_COL_W  = 12
const PX_PER_SEC = 80
const KEY_H      = 52
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])

interface Props {
  midiData: MidiData
  noteSystem: NoteSystem
  labelColor: string
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function PianoRoll({ midiData, noteSystem, labelColor }: Props) {
  const { notes, durationSeconds, tracks, bpm, songName, fileName } = midiData

  const [playing,    setPlaying]    = useState(false)
  const [elapsed,    setElapsed]    = useState(0)
  const [containerW, setContainerW] = useState(800)

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const toneRef      = useRef<typeof import('tone') | null>(null)
  const synthRef     = useRef<any>(null)
  const partRef      = useRef<any>(null)
  const rafRef       = useRef<number | undefined>(undefined)

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
  const colW       = Math.max(MIN_COL_W, containerW / pitchRange)
  const rollW      = Math.round(pitchRange * colW)
  const rollH      = Math.ceil(durationSeconds + 2) * PX_PER_SEC
  const multiTrack = tracks.length > 1

  function pitchToX(midi: number) { return (midi - minMidi) * colW }

  const timeMarkers = useMemo(() => {
    const step = durationSeconds > 180 ? 30 : durationSeconds > 90 ? 15 : 10
    const out: number[] = []
    for (let t = 0; t <= durationSeconds + 2; t += step) out.push(t)
    return out
  }, [durationSeconds])

  const cPitches = useMemo(() => {
    const out: number[] = []
    for (let m = minMidi; m <= maxMidi; m++) if (m % 12 === 0) out.push(m)
    return out
  }, [minMidi, maxMidi])

  // ── Draw roll to canvas ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || rollW === 0 || rollH === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = rollW * dpr
    canvas.height = rollH * dpr
    canvas.style.width  = rollW + 'px'
    canvas.style.height = rollH + 'px'

    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // 1. Background pitch columns
    for (let i = 0; i < pitchRange; i++) {
      const midi    = minMidi + i
      const isBlack = BLACK_KEYS.has(midi % 12)
      ctx.fillStyle = isBlack ? '#1e293b' : '#0f172a'
      ctx.fillRect(i * colW, 0, colW, rollH)
    }

    // 2. C guide lines
    ctx.strokeStyle = '#334155'
    ctx.lineWidth   = 1
    ctx.setLineDash([4, 3])
    for (const midi of cPitches) {
      const x = pitchToX(midi)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, rollH)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // 3. Time grid + labels
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth   = 1
    ctx.fillStyle   = '#6b7280'
    ctx.font        = '8px Arial, Helvetica, sans-serif'
    for (const t of timeMarkers) {
      const y = t * PX_PER_SEC
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(rollW, y)
      ctx.stroke()
      ctx.fillStyle = '#6b7280'
      ctx.fillText(fmtTime(t), 3, y + 10)
    }

    // 4. Notes
    for (const note of notes) {
      const x     = pitchToX(note.midi)
      const y     = note.time * PX_PER_SEC
      const h     = Math.max(2, note.duration * PX_PER_SEC)
      const w     = colW - 2
      const color = multiTrack
        ? (tracks[note.trackIndex]?.color ?? '#6366f1')
        : labelColor
      const alpha = 0.45 + note.velocity * 0.55

      ctx.globalAlpha = alpha
      ctx.fillStyle   = color
      ctx.beginPath()
      ctx.roundRect(x + 1, y, w, h, 1.5)
      ctx.fill()

      // Label — only when tall enough
      if (h >= 14) {
        ctx.globalAlpha = 1
        ctx.fillStyle   = 'white'
        ctx.font        = 'bold 7px Arial, Helvetica, sans-serif'
        ctx.textAlign   = 'center'
        ctx.fillText(
          getMidiNoteName(note.midi, noteSystem),
          x + colW / 2,
          y + h - 3
        )
      }
    }
    ctx.globalAlpha = 1
  }, [notes, colW, rollW, rollH, pitchRange, minMidi, noteSystem, labelColor,
      multiTrack, tracks, cPitches, timeMarkers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── rAF tick ───────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const Tone = toneRef.current
    if (!Tone) return
    const transportT = Tone.Transport.seconds
    const lookAhead  = (Tone as any).getContext?.()?.lookAhead ?? 0.1
    const visualT    = Math.max(0, transportT - lookAhead)
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, visualT * PX_PER_SEC)
    setElapsed(transportT)
    if (transportT < durationSeconds + 2) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      stopPlayback(true)
    }
  }, [durationSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop helper ────────────────────────────────────────────────────────────
  const stopPlayback = useCallback((finished = false) => {
    cancelAnimationFrame(rafRef.current!)
    const Tone = toneRef.current
    if (Tone) { Tone.Transport.stop(); Tone.Transport.cancel() }
    partRef.current?.dispose()
    partRef.current = null
    if (!finished && scrollRef.current) scrollRef.current.scrollTop = 0
    setPlaying(false)
    setElapsed(0)
  }, [])

  // ── Play / Pause ───────────────────────────────────────────────────────────
  async function handlePlay() {
    if (!toneRef.current) toneRef.current = await import('tone')
    const Tone = toneRef.current
    await Tone.start()
    if (Tone.Transport.state === 'paused') {
      Tone.Transport.start()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    synthRef.current?.dispose()
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' as any },
      envelope: { attack: 0.02, decay: 3, sustain: 0, release: 1 },
      volume: -8,
    }).toDestination()
    partRef.current = new Tone.Part(
      (time: number, ev: { midi: number; duration: number; velocity: number }) => {
        synthRef.current?.triggerAttackRelease(
          Tone.Frequency(ev.midi, 'midi').toFrequency(),
          ev.duration, time, ev.velocity
        )
      },
      notes.map(n => ({ time: n.time, midi: n.midi, duration: n.duration, velocity: n.velocity }))
    )
    partRef.current.start(0)
    Tone.Transport.start()
    setPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }

  function handlePause() {
    toneRef.current?.Transport.pause()
    cancelAnimationFrame(rafRef.current!)
    setPlaying(false)
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current!)
    toneRef.current?.Transport.stop()
    toneRef.current?.Transport.cancel()
    synthRef.current?.dispose()
    partRef.current?.dispose()
  }, [])

  useEffect(() => { stopPlayback(false) }, [midiData, stopPlayback])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setContainerW(entries[0].contentRect.width))
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  const progress = durationSeconds > 0 ? Math.min(elapsed / durationSeconds, 1) : 0
  const title    = songName || fileName.replace(/\.[^.]+$/, '')

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-1 truncate">{title}</h2>

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

      {multiTrack && (
        <div className="flex flex-wrap gap-3 mb-3 print:hidden">
          {tracks.map(t => (
            <div key={t.index} className="flex items-center gap-1.5 text-xs text-gray-400">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: t.color }} />
              {t.name}
            </div>
          ))}
        </div>
      )}

      {/* Transport */}
      <div className="flex items-center gap-3 mb-3 print:hidden">
        <button
          onClick={playing ? handlePause : handlePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-white"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1"/>
              <rect x="8" y="1" width="4" height="12" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="2,1 13,7 2,13"/>
            </svg>
          )}
        </button>
        <button
          onClick={() => stopPlayback(false)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-white"
          title="Stop"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="0" y="0" width="10" height="10" rx="1"/>
          </svg>
        </button>
        <div className="flex-1 flex items-center gap-2">
          <div
            className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              if (toneRef.current)
                toneRef.current.Transport.seconds = ((e.clientX - rect.left) / rect.width) * durationSeconds
            }}
          >
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="text-xs text-gray-400 tabular-nums w-16 text-right">
            {fmtTime(elapsed)} / {fmtTime(durationSeconds)}
          </span>
        </div>
      </div>

      {/* Piano roll */}
      <div ref={containerRef} className="rounded-xl overflow-hidden border border-gray-700 bg-gray-950">

        {/* Keyboard strip (SVG — small, static) */}
        <div className="border-b border-gray-700 bg-gray-900 overflow-hidden" style={{ height: KEY_H }}>
          <svg width={rollW} height={KEY_H} style={{ display: 'block' }}>
            {Array.from({ length: pitchRange }, (_, i) => {
              const midi    = minMidi + i
              const pc      = midi % 12
              const isBlack = BLACK_KEYS.has(pc)
              const isC     = pc === 0
              const x       = i * colW
              return (
                <g key={midi}>
                  <rect x={x} y={0} width={colW} height={KEY_H}
                    fill={isBlack ? '#1f2937' : '#f1f5f9'}
                    stroke="#374151" strokeWidth={0.5}
                  />
                  {isC && (
                    <text x={x + colW / 2} y={KEY_H - 4}
                      textAnchor="middle" fontSize={7}
                      fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold"
                      fill={isBlack ? '#9ca3af' : '#374151'}
                    >
                      {getMidiNoteNameWithOctave(midi, noteSystem)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Canvas roll — drawn once, browser scrolls it for free */}
        <div
          ref={scrollRef}
          className="overflow-y-auto overflow-x-hidden"
          style={{ maxHeight: '65vh', scrollBehavior: 'auto' }}
        >
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
      </div>
    </div>
  )
}
