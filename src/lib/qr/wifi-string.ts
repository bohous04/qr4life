/**
 * Staví nativní Wi-Fi QR obsah (formát ZXing):
 * WIFI:T:WPA;S:ssid;P:heslo;H:true;;
 * Speciální znaky (\ ; , :) se escapují zpětným lomítkem.
 */
function esc(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export function wifiString(payload: {
  ssid: string;
  password: string | null;
  hidden: boolean;
}): string {
  const type = payload.password ? 'WPA' : 'nopass';
  const pass = payload.password ? `P:${esc(payload.password)};` : '';
  const hidden = payload.hidden ? 'H:true;' : '';
  return `WIFI:T:${type};S:${esc(payload.ssid)};${pass}${hidden};`;
}
