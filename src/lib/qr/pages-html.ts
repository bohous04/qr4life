import { texts } from '@/lib/i18n/cs';

/**
 * Samostatné HTML stránky pro redirect endpoint (Wi-Fi, text, 404, neaktivní,
 * zablokovaný). Vše inline — žádné externí CSS/JS, rychlé načtení po skenu.
 * Barvy značky: ink #141210, papír #FDFCFA, akcent #FF4A00.
 */

const CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    background:#FDFCFA;color:#141210;min-height:100vh;display:flex;
    align-items:center;justify-content:center;padding:24px}
  .card{max-width:420px;width:100%}
  h1{font-size:28px;line-height:1.15;letter-spacing:-0.02em;margin-bottom:12px}
  p{color:#57534E;font-size:16px;line-height:1.5;margin-bottom:8px}
  a.button,button.button{display:inline-block;background:#FF4A00;color:#fff;border:0;
    font-size:16px;font-weight:600;padding:12px 20px;border-radius:6px;
    text-decoration:none;cursor:pointer;margin-top:8px}
  .logo{font-weight:700;font-size:14px;letter-spacing:0.06em;margin-bottom:28px;
    display:inline-block;text-decoration:none;color:#141210}
  .logo span{color:#FF4A00}
  .credit{margin-top:36px;font-size:12px;text-align:center}
  .credit a{color:#A8A29E;text-decoration:none}
  .credit a:hover{color:#57534E}
  .row{display:flex;justify-content:space-between;align-items:center;gap:12px;
    padding:14px 0;border-top:1px solid #E7E5E4}
  .row:first-of-type{border-top:0}
  .label{font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#A8A29E}
  .value{font-size:18px;font-weight:600;word-break:break-all}
  img.qr{display:block;margin:24px auto 0;width:200px;height:200px}
  .hint{text-align:center;font-size:13px;color:#A8A29E;margin-top:12px}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · ${texts.brand}</title>
<style>${CSS}</style>
</head>
<body>
<div class="card">
<a class="logo" href="/">QR<span>4</span>LIFE</a>
${body}
<p class="credit"><a href="${texts.common.creditUrl}" target="_blank" rel="noreferrer">${texts.common.credit}</a></p>
</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function branded404Html(): string {
  return page(
    texts.qr.status.notFoundTitle,
    `<h1>${texts.qr.status.notFoundTitle}</h1>
<p>${texts.qr.status.notFoundBody}</p>
<a class="button" href="/">${texts.qr.status.goHome}</a>`,
  );
}

export function inactiveHtml(): string {
  return page(
    texts.qr.status.inactiveTitle,
    `<h1>${texts.qr.status.inactiveTitle}</h1>
<p>${texts.qr.status.inactiveBody}</p>`,
  );
}

export function blockedHtml(): string {
  return page(
    texts.qr.status.blockedTitle,
    `<h1>${texts.qr.status.blockedTitle}</h1>
<p>${texts.qr.status.blockedBody}</p>`,
  );
}

export function textPageHtml(text: string): string {
  return page(
    texts.qr.text.title,
    `<h1>${escapeHtml(text).replace(/\n/g, '<br>')}</h1>`,
  );
}

export function wifiPageHtml(payload: {
  ssid: string;
  password: string | null;
  hidden: boolean;
  wifiQrDataUrl: string;
}): string {
  const passwordBlock = payload.password
    ? `<div class="row">
  <div>
    <div class="label">${texts.qr.wifi.password}</div>
    <div class="value" id="wifi-password">${escapeHtml(payload.password)}</div>
  </div>
</div>
<button class="button" type="button" id="copy-btn">${texts.qr.wifi.copy}</button>
<p class="hint" id="copy-hint" hidden>${texts.qr.wifi.copied}</p>`
    : `<p>${texts.qr.wifi.openNetwork}</p>`;

  return page(
    `${texts.qr.wifi.title} · ${payload.ssid}`,
    `<h1>${texts.qr.wifi.title}</h1>
<div class="row">
  <div>
    <div class="label">${texts.qr.wifi.network}</div>
    <div class="value">${escapeHtml(payload.ssid)}</div>
  </div>
</div>
${passwordBlock}
<img class="qr" src="${payload.wifiQrDataUrl}" alt="Wi-Fi QR kód" width="200" height="200">
<p class="hint">${texts.qr.wifi.scanHint}</p>
<script>
document.getElementById('copy-btn')?.addEventListener('click', function () {
  var value = document.getElementById('wifi-password').textContent;
  navigator.clipboard.writeText(value).then(function () {
    document.getElementById('copy-hint').hidden = false;
  });
});
</script>`,
  );
}

export function audioPageHtml(params: { title: string; src: string }): string {
  return page(
    `${texts.qr.audio.title} · ${params.title}`,
    `<h1>${escapeHtml(params.title)}</h1>
<audio id="player" src="${escapeHtml(params.src)}" preload="metadata" style="width:100%;margin-top:16px"></audio>
<button class="button" type="button" id="play-btn">${texts.qr.audio.play}</button>
<p class="hint">${texts.qr.audio.hint}</p>
<script>
(function () {
  var player = document.getElementById('player');
  var button = document.getElementById('play-btn');
  function sync() {
    button.textContent = player.paused ? ${JSON.stringify(texts.qr.audio.play)} : ${JSON.stringify(texts.qr.audio.pause)};
  }
  button.addEventListener('click', function () {
    if (player.paused) player.play(); else player.pause();
  });
  player.addEventListener('play', sync);
  player.addEventListener('pause', sync);
  player.play().catch(function () { /* autoplay blokován — zbývá tlačítko */ });
  sync();
})();
</script>`,
  );
}
