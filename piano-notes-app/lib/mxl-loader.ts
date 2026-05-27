import JSZip from 'jszip'

/**
 * Given a File that is either .mxl (zipped MusicXML) or .xml/.musicxml,
 * returns the raw MusicXML string.
 */
export async function loadMusicXml(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.mxl')) {
    const zip = await JSZip.loadAsync(file)
    // The main score file is listed in META-INF/container.xml,
    // but by convention it is always a .xml file that is not under META-INF.
    const xmlEntry = Object.keys(zip.files).find(
      (f) => f.endsWith('.xml') && !f.startsWith('META-INF')
    )
    if (!xmlEntry) throw new Error('No XML score found inside the .mxl archive.')
    return zip.files[xmlEntry].async('string')
  }

  if (name.endsWith('.xml') || name.endsWith('.musicxml')) {
    return file.text()
  }

  throw new Error(`Unsupported file type: ${file.name}. Please upload a .mxl or .xml file.`)
}
