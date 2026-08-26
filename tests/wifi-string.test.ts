import { describe, expect, it } from 'vitest';
import { wifiString } from '@/lib/qr/wifi-string';

describe('wifiString', () => {
  it('escapuje speciální znaky v hesle', () => {
    expect(
      wifiString({ ssid: 'Home', password: 'pa:ss;wo\\rd', hidden: false }),
    ).toBe('WIFI:T:WPA;S:Home;P:pa\\:ss\\;wo\\\\rd;;');
  });

  it('escapuje speciální znaky v SSID', () => {
    expect(wifiString({ ssid: 'a,b;c', password: '12345678', hidden: false })).toBe(
      'WIFI:T:WPA;S:a\\,b\\;c;P:12345678;;',
    );
  });

  it('otevřená síť bez hesla', () => {
    expect(wifiString({ ssid: 'FreeNet', password: null, hidden: false })).toBe(
      'WIFI:T:nopass;S:FreeNet;;',
    );
  });

  it('skrytá síť obsahuje H:true', () => {
    expect(wifiString({ ssid: 'Net', password: '12345678', hidden: true })).toBe(
      'WIFI:T:WPA;S:Net;P:12345678;H:true;;',
    );
  });
});
