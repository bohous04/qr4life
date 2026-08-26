import { ImageResponse } from 'next/og';
import { texts } from '@/lib/i18n/cs';

export const alt = `${texts.brand} — ${texts.home.hero.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          background: '#FDFCFA',
          color: '#141210',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 90,
            display: 'flex',
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          QR<span style={{ color: '#FF4A00' }}>4</span>LIFE
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
          }}
        >
          <div style={{ display: 'flex' }}>
            Vytiskneš&nbsp;<span style={{ color: '#FF4A00' }}>jednou</span>.
          </div>
          <div style={{ display: 'flex' }}>
            Měníš&nbsp;<span style={{ color: '#FF4A00' }}>kdykoliv</span>.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 26,
            fontSize: 27,
            lineHeight: 1.35,
            color: '#57534E',
            maxWidth: 620,
          }}
        >
          Dynamické QR kódy, které nikdy nezestárnou. Cíl změňte za pár vteřin — bez tisku nového.
        </div>

        <div style={{ position: 'absolute', bottom: 52, left: 90, display: 'flex', fontSize: 24, color: '#A8A29E' }}>
          qr.lnrtdev.cz
        </div>

        {/* QR motif — satori neumí grid, proto flex řádky */}
        <div
          style={{
            position: 'absolute',
            right: 90,
            top: 180,
            width: 270,
            height: 270,
            background: '#141210',
            borderRadius: 26,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {[
            [1,1,1,0,1,1,2],
            [1,0,1,0,1,0,1],
            [1,1,1,0,1,1,0],
            [0,0,0,2,0,0,0],
            [1,1,1,0,1,1,1],
            [1,0,1,0,1,0,1],
            [2,1,0,0,1,1,1],
          ].map((row, rowIndex) => (
            <div key={rowIndex} style={{ display: 'flex', flex: 1, gap: 6 }}>
              {row.map((cell, cellIndex) => (
                <div
                  key={cellIndex}
                  style={{
                    flex: 1,
                    background: cell === 0 ? 'transparent' : cell === 2 ? '#FF4A00' : '#FDFCFA',
                    borderRadius: 3,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
