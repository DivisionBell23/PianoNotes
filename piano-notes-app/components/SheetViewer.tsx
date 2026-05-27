'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { getNoteName, type NoteSystem } from '@/lib/note-names'

// ── Key signature helpers ─────────────────────────────────────────────────────

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER  = ['B', 'E', 'A', 'D', 'G', 'C', 'F']
const NOTE_STEPS: Record<number, string> = { 0:'C', 2:'D', 4:'E', 5:'F', 7:'G', 9:'A', 11:'B' }

function parseKeySignature(xml: string): Record<string, number> {
  const match = xml.match(/<fifths>([-\d]+)<\/fifths>/)
  const fifths = match ? parseInt(match[1], 10) : 0
  const keySig: Record<string, number> = {}
  if (fifths > 0) {
    for (let i = 0; i < fifths && i < 7; i++) keySig[SHARP_ORDER[i]] = 0
  } else if (fifths < 0) {
    for (let i = 0; i < -fifths && i < 7; i++) keySig[FLAT_ORDER[i]] = 1
  }
  return keySig
}

// ── Label positioning constants ───────────────────────────────────────────────

const LABEL_H = 11  // badge height in px

interface DisplayLabel {
  id: string
  name: string
  x: number          // px (left edge or center depending on mode)
  finalTop: number   // px from container top
  staffIndex: number
  accidental: number
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawNote {
  fundamentalNote: number
  accidental: number
  x: number              // px from container left (multi-page, for HTML overlay)
  y: number              // px from container top  (multi-page, for HTML overlay)
  xPagePx: number        // px from SVG left  (page-local, for SVG injection)
  yPagePx: number        // px from SVG top   (page-local, for SVG injection)
  pageIndex: number
  staffIndex: number
  staffTopPx: number     // container-relative top of this note's staff line
  staffTopPagePx: number // page-local top of this note's staff line (for print SVG)
  id: string
}

interface Props {
  xmlContent: string
  noteSystem: NoteSystem
  labelColor: string
  labelPosition: 'outside' | 'ontop'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SheetViewer({ xmlContent, noteSystem, labelColor, labelPosition }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const overlayRef    = useRef<HTMLDivElement>(null)
  const svgsRef       = useRef<SVGElement[]>([])
  const rawNotesRef      = useRef<RawNote[]>([])
  const noteSystemRef    = useRef<NoteSystem>(noteSystem)
  const labelColorRef    = useRef<string>(labelColor)
  const labelPositionRef = useRef<'outside' | 'ontop'>(labelPosition)

  const [rawNotes, setRawNotes] = useState<RawNote[]>([])
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState<string | null>(null)

  // Keep refs in sync with latest props so beforeprint always has current values
  useEffect(() => { noteSystemRef.current    = noteSystem    }, [noteSystem])
  useEffect(() => { labelColorRef.current    = labelColor    }, [labelColor])
  useEffect(() => { labelPositionRef.current = labelPosition }, [labelPosition])
  useEffect(() => { rawNotesRef.current      = rawNotes      }, [rawNotes])

  // ── beforeprint / afterprint ──────────────────────────────────────────────
  useEffect(() => {
    function onBeforePrint() {
      const svgs  = svgsRef.current
      const notes = rawNotesRef.current

      // 1. Remove explicit SVG height so CSS height:auto uses viewBox aspect ratio
      svgs.forEach(svg => {
        svg.dataset.origHeight = svg.getAttribute('height') ?? ''
        svg.removeAttribute('height')
      })

      // 2. Build SVG-space labels in page-local pixel coordinates.
      //    xPagePx / yPagePx are already in the SVG's own pixel coordinate space,
      //    so they scale correctly when the SVG is stretched to fill the paper.
      const pos = labelPositionRef.current
      const rawSvgLabels = notes.map(n => ({
        name:           getNoteName(n.fundamentalNote, n.accidental, noteSystemRef.current),
        xPx:            n.xPagePx - 3,
        yPx:            n.yPagePx,
        pageIndex:      n.pageIndex,
        staffTopPagePx: n.staffTopPagePx,
      }))

      // 'ontop' → beside the note (shifted right so note is visible)
      // 'outside' → all labels at uniform y = top of their staff line
      const svgLabels: Array<{ name: string; xPx: number; yPx: number; pageIndex: number; leftAligned: boolean }> =
        pos === 'ontop'
          ? rawSvgLabels.map(l => ({ ...l, xPx: l.xPx + 6, yPx: l.yPx - LABEL_H / 2, leftAligned: true }))
          : rawSvgLabels.map(l => ({ ...l, yPx: l.staffTopPagePx - LABEL_H - 2, leftAligned: false }))

      // 3. Inject <g class="print-label"> badges into each page SVG
      const color  = labelColorRef.current
      const SVG_NS = 'http://www.w3.org/2000/svg'
      const FONT_SIZE = 8.5
      const PAD_X     = 2.5
      const PAD_Y     = 1

      svgLabels.forEach((lbl) => {
        const svg = svgs[lbl.pageIndex]
        if (!svg) return

        // Estimate badge width (proportional to character count)
        const badgeW = lbl.name.length * FONT_SIZE * 0.62 + PAD_X * 2

        const g = document.createElementNS(SVG_NS, 'g')
        g.setAttribute('class', 'print-label')

        // leftAligned: badge left edge starts at xPx (ontop/beside mode)
        // centered: badge centered on xPx (outside mode)
        const rectX = lbl.leftAligned ? lbl.xPx : lbl.xPx - badgeW / 2
        const textX = lbl.leftAligned ? lbl.xPx + badgeW / 2 : lbl.xPx

        const rect = document.createElementNS(SVG_NS, 'rect')
        rect.setAttribute('x',      String(rectX))
        rect.setAttribute('y',      String(lbl.yPx))
        rect.setAttribute('width',  String(badgeW))
        rect.setAttribute('height', String(LABEL_H))
        rect.setAttribute('rx',     '1.5')
        rect.setAttribute('ry',     '1.5')
        rect.setAttribute('fill',         'white')
        rect.setAttribute('stroke',       'black')
        rect.setAttribute('stroke-width', '1.2')

        const text = document.createElementNS(SVG_NS, 'text')
        text.setAttribute('x',           String(textX))
        // Center text vertically inside badge
        text.setAttribute('y',           String(lbl.yPx + PAD_Y + FONT_SIZE))
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('font-size',   String(FONT_SIZE))
        text.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
        text.setAttribute('font-weight', 'bold')
        text.setAttribute('fill',        'black')
        text.textContent = lbl.name

        g.appendChild(rect)
        g.appendChild(text)
        svg.appendChild(g)
      })

      // 4. Hide the HTML overlay — SVG labels replace it for print
      if (overlayRef.current) overlayRef.current.style.display = 'none'
    }

    function onAfterPrint() {
      // Restore SVG heights
      svgsRef.current.forEach(svg => {
        if (svg.dataset.origHeight) svg.setAttribute('height', svg.dataset.origHeight)
        delete svg.dataset.origHeight
      })

      // Remove injected labels
      svgsRef.current.forEach(svg => {
        svg.querySelectorAll('.print-label').forEach(el => el.remove())
      })

      // Restore HTML overlay
      if (overlayRef.current) overlayRef.current.style.display = ''
    }

    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint',  onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint',  onAfterPrint)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!containerRef.current) return
      setLoading(true)
      setError(null)
      setRawNotes([])

      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')

        containerRef.current.innerHTML = ''
        svgsRef.current = []

        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: false,
          backend: 'svg',
          drawTitle: true,
          drawSubtitle: true,
          drawComposer: true,
          drawCredits: true,
        })

        await osmd.load(xmlContent)
        osmd.render()

        if (cancelled) return

        const keySig = parseKeySignature(xmlContent)

        const svgs = Array.from(containerRef.current.querySelectorAll('svg'))
        if (svgs.length === 0) throw new Error('OSMD produced no SVG output.')

        const firstSvgPxWidth = svgs[0].getBoundingClientRect().width
          || parseFloat(svgs[0].getAttribute('width') ?? '800')
        const pageWidthUnits: number = (osmd as any).Sheet?.pageWidth ?? 180
        const uip = firstSvgPxWidth / pageWidthUnits   // px per OSMD unit

        const containerTop = containerRef.current.getBoundingClientRect().top
        const svgOffsets = svgs.map(svg => svg.getBoundingClientRect().top - containerTop)

        const graphic = (osmd as any).graphic
        const pages: any[] = graphic?.MusicPages ?? []
        const collected: RawNote[] = []

        pages.forEach((page: any, pageIndex: number) => {
          const svgOffsetY = svgOffsets[pageIndex] ?? 0

          const systems: any[] = page.MusicSystems ?? []
          systems.forEach((system: any, systemIndex: number) => {
            const staffLines: any[] = system.StaffLines ?? []

            staffLines.forEach((staffLine: any, staffLineIndex: number) => {
              // Compute staff top once per staff line; stored directly on each note
              const staffAbsPos = staffLine.PositionAndShape?.AbsolutePosition
              const staffTopPagePx = staffAbsPos ? (staffAbsPos.y as number) * uip : -1
              const staffTopPx     = staffAbsPos ? svgOffsetY + staffTopPagePx : -1

              const measures: any[] = staffLine.Measures ?? []

              measures.forEach((measure: any) => {
                if (!measure) return

                measure.staffEntries?.forEach((staffEntry: any) => {
                  staffEntry?.graphicalVoiceEntries?.forEach((voiceEntry: any) => {
                    voiceEntry?.notes?.forEach((gNote: any) => {
                      const srcNote = gNote?.sourceNote
                      if (!srcNote || srcNote.isRest?.()) return

                      const pitch = srcNote.Pitch
                      if (!pitch) return

                      const pos = gNote.PositionAndShape?.AbsolutePosition
                      if (!pos) return

                      const fundamentalNote = pitch.FundamentalNote as number
                      let accidental = (pitch.Accidental as number) ?? 2

                      if (accidental === 2) {
                        const step = NOTE_STEPS[fundamentalNote]
                        if (step && step in keySig) accidental = keySig[step]
                      } else if (accidental === 3) {
                        accidental = 2
                      }

                      const xPagePx = pos.x * uip
                      const yPagePx = pos.y * uip
                      const noteY   = svgOffsetY + yPagePx

                      collected.push({
                        fundamentalNote,
                        accidental,
                        x: xPagePx,
                        y: noteY,
                        xPagePx,
                        yPagePx,
                        pageIndex,
                        staffIndex: systemIndex * 100 + staffLineIndex,
                        staffTopPx:     staffTopPx     >= 0 ? staffTopPx     : noteY - 30,
                        staffTopPagePx: staffTopPagePx >= 0 ? staffTopPagePx : yPagePx - 30,
                        id: `${pageIndex}-${systemIndex}-${staffLineIndex}-${pos.x.toFixed(2)}-${pos.y.toFixed(2)}-${fundamentalNote}-${accidental}`,
                      })
                    })
                  })
                })
              })
            })
          })
        })

        if (cancelled) return

        // Wrap each SVG in a print-page div AFTER measuring positions
        svgs.forEach((svg, i) => {
          const wrapper = document.createElement('div')
          wrapper.className = 'print-page-wrapper'
          wrapper.style.display = 'block'
          wrapper.style.width   = '100%'
          if (i > 0) {
            wrapper.style.breakBefore     = 'page'
            wrapper.style.pageBreakBefore = 'always'
          }
          svg.parentNode!.insertBefore(wrapper, svg)
          wrapper.appendChild(svg)
          svg.style.display = 'block'
          svg.style.width   = '100%'
        })

        svgsRef.current = svgs as unknown as SVGElement[]
        setRawNotes(collected)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to render score')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [xmlContent])

  const labels = useMemo(() => {
    const named = rawNotes.map(n => ({
      id:           n.id,
      name:         getNoteName(n.fundamentalNote, n.accidental, noteSystem),
      x:            n.x - 3,
      y:            n.y,
      staffTopPx:   n.staffTopPx,
      accidental:   n.accidental,
    }))

    if (labelPosition === 'ontop') {
      // Place label beside (right of) note head so the note stays visible
      return named.map(n => ({ ...n, x: n.x + 3, finalTop: n.y - LABEL_H / 2 }))
    }

    // 'outside': label sits just above the top of its own staff line
    return named.map(n => ({ ...n, finalTop: n.staffTopPx - LABEL_H - 2 }))
  }, [rawNotes, noteSystem, labelPosition])

  return (
    <div>
      {/* Controls bar */}
      {!loading && rawNotes.length > 0 && (
        <div className="flex items-center justify-between mb-4 print:hidden">
          <p className="text-gray-500 text-sm">{rawNotes.length} notes annotated</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Rendering score…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/60 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Score + label overlay */}
      <div className="relative">
        <div
          ref={containerRef}
          id="piano-score"
          className={`w-full bg-white rounded-xl ${loading ? 'invisible' : 'visible'}`}
        />

        {!loading && labels.length > 0 && (
          <div ref={overlayRef} className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {labels.map(label => (
              <span
                key={label.id}
                className="note-label absolute inline-flex items-center justify-center
                           text-[8.5px] font-bold leading-none select-none
                           rounded-sm px-[2.5px] py-[1px]"
                style={{
                  left: label.x,
                  top: label.finalTop,
                  // outside: center badge on note x; ontop: left-align (badge starts at note right edge)
                  transform: labelPosition === 'ontop' ? 'none' : 'translate(-50%, 0)',
                  backgroundColor: labelColor,
                  color: 'white',
                  lineHeight: '1',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact' as 'exact',
                  outline: '1.5px solid rgba(0,0,0,0.6)',
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
