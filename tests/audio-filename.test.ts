import { describe, expect, it } from 'vitest';
import { sanitizeAudioFilename } from '@/lib/audio/sniff';

describe('sanitizeAudioFilename', () => {
  it('nechá normální název beze změny', () => {
    expect(sanitizeAudioFilename('pisen.mp3')).toBe('pisen.mp3');
  });

  it('odstraní řídicí znaky', () => {
    expect(sanitizeAudioFilename('pisen\x00\x1f\x7f.mp3')).toBe('pisen.mp3');
    expect(sanitizeAudioFilename('a\r\nb.mp3')).toBe('ab.mp3');
  });

  it('odstraní uvozovky', () => {
    expect(sanitizeAudioFilename('"pisen".mp3')).toBe('pisen.mp3');
    expect(sanitizeAudioFilename("'pisen'.mp3")).toBe('pisen.mp3');
    expect(sanitizeAudioFilename('`pisen`.mp3')).toBe('pisen.mp3');
  });

  it('odstraní zpětné lomítko', () => {
    expect(sanitizeAudioFilename('pi\\sen.mp3')).toBe('pisen.mp3');
  });

  it('odstraní oddělovač cesty /', () => {
    expect(sanitizeAudioFilename('pi/sen.mp3')).toBe('pisen.mp3');
  });

  it('zneškodní pokus o traversal ../../etc/passwd', () => {
    const result = sanitizeAudioFilename('../../etc/passwd');
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
  });

  it('zkrátí přes 200 znaků dlouhý název', () => {
    const long = `${'a'.repeat(250)}.mp3`;
    const result = sanitizeAudioFilename(long);
    expect(result.length).toBe(200);
  });

  it('u prázdného nebo nepoužitelného názvu vrátí audio', () => {
    expect(sanitizeAudioFilename('')).toBe('audio');
    expect(sanitizeAudioFilename('   ')).toBe('audio');
    expect(sanitizeAudioFilename('"""')).toBe('audio');
  });
});
