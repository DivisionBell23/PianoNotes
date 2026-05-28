'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import SheetViewer from '@/components/SheetViewer'
import PianoRoll from '@/components/PianoRoll'
import type { FilePayload } from '@/lib/file-payload'
import type { NoteSystem } from '@/lib/note-names'

const PRESET_COLORS = [
  { hex: '#2563eb', label: 'Blue'   },
  { hex: '#16a34a', label: 'Green'  },
  { hex: '#7c3aed', label: 'Purple' },
  { hex: '#d97706', label: 'Amber'  },
  { hex: '#0891b2', label: 'Teal'   },
]

export default function Home() {
  const [payload,       setPayload]       = useState<FilePayload | null>(null)
  const [noteSystem,    setNoteSystem]    = useState<NoteSystem>('english')
  const [labelColor,    setLabelColor]    = useState(PRESET_COLORS[0].hex)
  const [labelPosition, setLabelPosition] = useState<'outside' | 'ontop'>('outside')

  function handleLoad(p: FilePayload) { setPayload(p) }
  function handleReset() { setPayload(null) }

  const isMidi = payload?.type === 'midi'
  const isXml  = payload?.type === 'xml'

  return (
    <div className="min-h-screen bg-gray-950 text-white print:bg-white print:text-black">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur print:hidden">
        {/* Top row: logo + change-file */}
        <div className="flex items-center gap-3 px-3 sm:px-6 py-2 sm:py-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Back to upload"
          >
            <span className="text-2xl select-none">🎹</span>
            <span className="text-lg font-semibold tracking-tight">PianoNotes</span>
          </button>

          <div className="flex-1" />

          {payload && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-white underline whitespace-nowrap"
            >
              Change file
            </button>
          )}
        </div>

        {/* Controls row */}
        {payload && (
          <div className="flex flex-wrap items-center gap-2 px-3 sm:px-6 pb-2 sm:pb-3">
            {/* Note system toggle */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 text-sm">
              {(['english', 'french'] as NoteSystem[]).map((sys) => (
                <button
                  key={sys}
                  onClick={() => setNoteSystem(sys)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                    noteSystem === sys
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">{sys === 'english' ? 'C D E' : 'Do Ré Mi'}</span>
                  <span className="hidden sm:inline">{sys === 'english' ? 'English  C D E…' : 'French  Do Ré Mi…'}</span>
                </button>
              ))}
            </div>

            {/* Label position toggle — MusicXML only */}
            {isXml && (
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1 text-sm">
                {(['outside', 'ontop'] as const).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setLabelPosition(pos)}
                    className={`px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                      labelPosition === pos
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {pos === 'outside' ? 'Outside staff' : 'On note'}
                  </button>
                ))}
              </div>
            )}

            {/* Color picker — single-track MIDI or MusicXML */}
            {(!isMidi || payload.type === 'midi' && payload.data.tracks.length <= 1) && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 text-xs">Color</span>
                {PRESET_COLORS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    title={label}
                    onClick={() => setLabelColor(hex)}
                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: hex,
                      borderColor: labelColor === hex ? 'white' : 'transparent',
                    }}
                  />
                ))}
                <label
                  title="Custom color"
                  className="w-6 h-6 rounded-full border-2 border-gray-600 overflow-hidden cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: labelColor }}
                >
                  <input
                    type="color"
                    value={labelColor}
                    onChange={e => setLabelColor(e.target.value)}
                    className="opacity-0 w-0 h-0"
                  />
                </label>
              </div>
            )}

            {/* File name (desktop) */}
            <span className="hidden sm:block text-gray-500 text-xs truncate max-w-[160px] ml-auto">
              {payload.fileName}
            </span>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8 print:max-w-none print:p-0 print:m-0">
        {!payload && (
          <FileUpload onLoad={handleLoad} />
        )}
        {isXml && (
          <SheetViewer
            xmlContent={payload.content}
            noteSystem={noteSystem}
            labelColor={labelColor}
            labelPosition={labelPosition}
          />
        )}
        {isMidi && (
          <PianoRoll
            midiData={payload.data}
            noteSystem={noteSystem}
            labelColor={labelColor}
          />
        )}
      </main>
    </div>
  )
}
