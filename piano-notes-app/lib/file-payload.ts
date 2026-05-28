import type { MidiData } from './midi-loader'

export type { MidiData } from './midi-loader'

export type XmlPayload = {
  type: 'xml'
  content: string
  fileName: string
}

export type MidiPayload = {
  type: 'midi'
  data: MidiData
  fileName: string
}

export type FilePayload = XmlPayload | MidiPayload
