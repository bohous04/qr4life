import { describe, expect, it } from 'vitest';
import {
  audioPageHtml,
  blockedHtml,
  branded404Html,
  inactiveHtml,
  textPageHtml,
  wifiPageHtml,
} from '@/lib/qr/pages-html';
import { texts } from '@/lib/i18n/cs';

describe('status pages', () => {
  it('404 má titulek a odkaz domů', () => {
    const html = branded404Html();
    expect(html).toContain('Tenhle kód nikde nevidíme');
    expect(html).toContain('href="/"');
  });

  it('inactive má titulek', () => {
    expect(inactiveHtml()).toContain('Tento kód je dočasně neaktivní');
  });

  it('blocked má titulek', () => {
    expect(blockedHtml()).toContain('Kód byl zablokován');
  });
});

describe('wifiPageHtml', () => {
  const html = wifiPageHtml({
    ssid: 'Chalupa',
    password: 'tajne-heslo',
    hidden: false,
    wifiQrDataUrl: 'data:image/png;base64,QUJD',
  });

  it('zobrazí SSID', () => {
    expect(html).toContain('Chalupa');
  });

  it('zobrazí heslo a tlačítko kopírování', () => {
    expect(html).toContain('tajne-heslo');
    expect(html).toContain('Kopírovat heslo');
    expect(html).toContain('navigator.clipboard.writeText');
  });

  it('obsahuje nativní Wi-Fi QR jako data URI', () => {
    expect(html).toContain('src="data:image/png;base64,QUJD"');
  });

  it('otevřená síť bez hesla', () => {
    const open = wifiPageHtml({
      ssid: 'FreeNet',
      password: null,
      hidden: false,
      wifiQrDataUrl: 'data:image/png;base64,QUJD',
    });
    expect(open).toContain('Otevřená síť');
  });
});

describe('textPageHtml', () => {
  it('zobrazí text', () => {
    expect(textPageHtml('Ahoj světe')).toContain('Ahoj světe');
  });
});

describe('audioPageHtml', () => {
  it('obsahuje název stopy, přehrávač a odkaz na stream', () => {
    const html = audioPageHtml({ title: 'Znělka & spol', src: '/abc1234/audio' });
    expect(html).toContain('Znělka &amp; spol');
    expect(html).toContain('<audio');
    expect(html).toContain('src="/abc1234/audio"');
    expect(html).toContain(texts.qr.audio.play);
  });

  it('escapuje nebezpečné znaky v názvu stopy včetně </script>', () => {
    const malicious = `<img src=x onerror=alert(1)>"'</script>`;
    const html = audioPageHtml({ title: malicious, src: '/abc1234/audio' });
    // Neescapovaný škodlivý řetězec se v H1 (ani nikde jinde) nesmí objevit doslovně.
    expect(html).not.toContain(malicious);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&lt;/script&gt;');
  });
});

describe('společné vlastnosti', () => {
  it('stránky jsou kompletní HTML dokumenty s viewportem', () => {
    for (const html of [branded404Html(), inactiveHtml(), blockedHtml(), textPageHtml('x'), wifiPageHtml({ ssid: 's', password: null, hidden: false, wifiQrDataUrl: 'data:image/png;base64,x' })]) {
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('viewport');
    }
  });
});
