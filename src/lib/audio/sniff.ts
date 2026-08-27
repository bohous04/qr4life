/**
 * Rozpoznání zvukového formátu z prvních bajtů souboru.
 * Hlavičce Content-Type od prohlížeče se nevěří — dá se přepsat.
 */

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_TRACKS_PER_USER = 20;

/**
 * Strop na velikost celého multipart požadavku: samotná zvuková data
 * (MAX_AUDIO_BYTES) plus rezerva na hlavičky/boundary vícedílného
 * formuláře. Používá se jak pro rychlou předběžnou kontrolu podle
 * Content-Length, tak pro tvrdý limit na streamu.
 */
export const MAX_UPLOAD_REQUEST_BYTES = MAX_AUDIO_BYTES + 4096;

export type AudioMime = 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/wav';

const EXTENSIONS: Record<AudioMime, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectAudioMime(bytes: Uint8Array): AudioMime | null {
  if (bytes.length === 0) return null;

  // Check ID3 (MP3 with ID3 tag)
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === 'ID3') return 'audio/mpeg';

  // Check MPEG frame sync: 11 jedniček — 0xFF následované 0xE0..0xFF
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'audio/mpeg';

  // Check M4A (ftyp at offset 4)
  if (bytes.length >= 8 && ascii(bytes, 4, 4) === 'ftyp') return 'audio/mp4';

  // Check OGG
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'OggS') return 'audio/ogg';

  // Check WAV (RIFF...WAVE)
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'audio/wav';

  return null;
}

export function audioExtension(mime: AudioMime): string {
  return EXTENSIONS[mime];
}

/**
 * Sanitizace názvu souboru z multipart uploadu. `file.name` je plně pod
 * kontrolou útočníka — než ho uložíme (zobrazuje se v dashboardu a
 * použije se při servírování souboru), zbavíme ho řídicích znaků,
 * uvozovek, zpětných lomítek a oddělovačů cest, sloučíme bílé znaky
 * a zkrátíme na 200 znaků. Když nezbyde nic použitelného, vrátíme 'audio'.
 */
export function sanitizeAudioFilename(name: string): string {
  const cleaned = name
    .replace(/[\x00-\x1f\x7f]/g, '') // řídicí znaky (včetně \r, \n, \t)
    .replace(/["'`\\/]/g, '') // uvozovky, zpětné lomítko, oddělovače cest
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  return cleaned || 'audio';
}
