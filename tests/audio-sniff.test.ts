import { describe, expect, it } from 'vitest';
import { audioExtension, detectAudioMime } from '@/lib/audio/sniff';

function bytes(...values: (number | string)[]): Uint8Array {
  const out: number[] = [];
  for (const value of values) {
    if (typeof value === 'number') out.push(value);
    else for (const char of value) out.push(char.charCodeAt(0));
  }
  return new Uint8Array(out);
}

describe('detectAudioMime', () => {
  it('pozná MP3 s ID3 tagem i bez něj', () => {
    expect(detectAudioMime(bytes('ID3', 3, 0, 0, 0, 0, 0, 0))).toBe('audio/mpeg');
    expect(detectAudioMime(bytes(0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0))).toBe('audio/mpeg');
  });

  it('pozná M4A podle ftyp na offsetu 4', () => {
    expect(detectAudioMime(bytes(0, 0, 0, 0x20, 'ftypM4A '))).toBe('audio/mp4');
  });

  it('pozná OGG a WAV', () => {
    expect(detectAudioMime(bytes('OggS', 0, 2, 0, 0))).toBe('audio/ogg');
    expect(detectAudioMime(bytes('RIFF', 0, 0, 0, 0, 'WAVEfmt '))).toBe('audio/wav');
  });

  it('odmítne cizí obsah', () => {
    expect(detectAudioMime(bytes('MZ', 0x90, 0, 0, 0, 0, 0))).toBeNull();
    expect(detectAudioMime(bytes(0x89, 'PNG', 13, 10, 26, 10))).toBeNull();
    expect(detectAudioMime(new Uint8Array())).toBeNull();
    expect(detectAudioMime(bytes('ID'))).toBeNull();
  });
});

describe('audioExtension', () => {
  it('mapuje mime na příponu', () => {
    expect(audioExtension('audio/mpeg')).toBe('mp3');
    expect(audioExtension('audio/mp4')).toBe('m4a');
    expect(audioExtension('audio/ogg')).toBe('ogg');
    expect(audioExtension('audio/wav')).toBe('wav');
  });
});
