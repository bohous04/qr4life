import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkSafeBrowsing } from '@/lib/security/safe-browsing';

const originalKey = process.env.GOOGLE_SAFE_BROWSING_KEY;

beforeEach(() => {
  process.env.GOOGLE_SAFE_BROWSING_KEY = 'test-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.GOOGLE_SAFE_BROWSING_KEY;
  else process.env.GOOGLE_SAFE_BROWSING_KEY = originalKey;
});

describe('checkSafeBrowsing', () => {
  it('bez klíče vrací ok (funkce vypnutá)', async () => {
    delete process.env.GOOGLE_SAFE_BROWSING_KEY;
    expect(await checkSafeBrowsing('https://example.com')).toBe('ok');
  });

  it('čistá URL → ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({})),
    );
    expect(await checkSafeBrowsing('https://example.com')).toBe('ok');
  });

  it('malware match → unsafe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          matches: [{ threatType: 'MALWARE', platformType: 'ANY_PLATFORM', threat: {} }],
        }),
      ),
    );
    expect(await checkSafeBrowsing('https://evil.example')).toBe('unsafe');
  });

  it('chyba API → ok (fail-open) a warn', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    expect(await checkSafeBrowsing('https://example.com')).toBe('ok');
  });

  it('posílá správné threatInfo', async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    await checkSafeBrowsing('https://example.com/neco');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('safebrowsing.googleapis.com');
    expect(url).toContain('key=test-key');
    const body = JSON.parse(init.body as string) as {
      threatInfo: { threatTypes: string[]; threatEntries: { url: string }[] };
    };
    expect(body.threatInfo.threatTypes).toContain('SOCIAL_ENGINEERING');
    expect(body.threatInfo.threatEntries[0].url).toBe('https://example.com/neco');
  });
});
