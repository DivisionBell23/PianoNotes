'use client'

import { useCallback, useState } from 'react'
import { loadMusicXml } from '@/lib/mxl-loader'
import { loadMidi } from '@/lib/midi-loader'
import type { FilePayload } from '@/lib/file-payload'

interface Props {
  onLoad: (payload: FilePayload) => void
}

export default function FileUpload({ onLoad }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setLoading(true)
      try {
        const name = file.name.toLowerCase()
        if (name.endsWith('.mid') || name.endsWith('.midi')) {
          const data = await loadMidi(file)
          onLoad({ type: 'midi', data, fileName: file.name })
        } else {
          const content = await loadMusicXml(file)
          onLoad({ type: 'xml', content, fileName: file.name })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [onLoad]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center">
        <div className="text-7xl mb-4 select-none">🎼</div>
        <h2 className="text-3xl font-bold text-white mb-2">PianoNotes</h2>
        <p className="text-gray-400 text-lg">
          Upload a sheet music file to annotate note names
        </p>
      </div>

      <label
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-indigo-400 bg-indigo-950/40 scale-[1.02]'
            : 'border-gray-600 hover:border-indigo-500 hover:bg-gray-900'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
      >
        <input
          type="file"
          accept=".mxl,.xml,.musicxml,.mid,.midi"
          className="hidden"
          onChange={handleChange}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-300">Loading score…</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3 select-none">📂</div>
            <p className="text-gray-200 font-medium mb-1">
              Drop your file here, or click to browse
            </p>
            <p className="text-gray-500 text-sm">MusicXML (.mxl, .xml) · MIDI (.mid, .midi)</p>
          </>
        )}
      </label>

      {error && (
        <div className="w-full max-w-lg bg-red-950/60 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
