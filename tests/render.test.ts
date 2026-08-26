import { describe, expect, it } from 'vitest';
import { renderQr } from '@/lib/qr/render';
import { wifiString } from '@/lib/qr/wifi-string';

describe('renderQr', () => {
  it('png vrací Buffer s PNG magic bytes', async () => {
    const png = (await renderQr('https://example.com', 'png')) as Buffer;
    expect(png).toBeInstanceOf(Buffer);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it('svg vrací string s <svg', async () => {
    const svg = (await renderQr('https://example.com', 'svg')) as string;
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('je deterministický', async () => {
    const a = await renderQr('https://example.com', 'svg');
    const b = await renderQr('https://example.com', 'svg');
    expect(a).toBe(b);
  });

  it('velikost lze nastavit', async () => {
    const small = (await renderQr('https://example.com', 'png', 128)) as Buffer;
    const large = (await renderQr('https://example.com', 'png', 1024)) as Buffer;
    expect(large.length).toBeGreaterThan(small.length);
  });

  it('wifi obsah se zakóduje', async () => {
    const svg = (await renderQr(wifiString({ ssid: 'Home', password: '12345678', hidden: false }), 'svg')) as string;
    expect(svg).toContain('<svg');
  });
});
