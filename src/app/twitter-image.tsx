import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  let pacificoData: ArrayBuffer | null = null
  try {
    const res = await fetch('https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-7Q3Q.woff')
    if (res.ok) pacificoData = await res.arrayBuffer()
  } catch {
    // font unavailable — fall back to system sans
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 26,
              background: 'linear-gradient(180deg, #6366F1 0%, #3730A3 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', position: 'relative', width: 52, height: 40 }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 32,
                  height: 11,
                  background: '#C7D2FE',
                  borderRadius: 6,
                  transformOrigin: 'left center',
                  transform: 'rotate(42deg)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  width: 32,
                  height: 11,
                  background: '#C7D2FE',
                  borderRadius: 6,
                  transformOrigin: 'right center',
                  transform: 'rotate(-42deg)',
                }}
              />
            </div>
          </div>
          <div
            style={{
              fontFamily: pacificoData ? 'Pacifico' : 'sans-serif',
              fontSize: 88,
              color: '#f8fafc',
              lineHeight: 1,
            }}
          >
            ortali
          </div>
        </div>
        <div
          style={{
            color: '#94a3b8',
            fontSize: 26,
            fontFamily: 'sans-serif',
            letterSpacing: '0.01em',
          }}
        >
          Free Invoice Generator for Freelancers &amp; Small Businesses
        </div>
      </div>
    ),
    {
      ...size,
      fonts: pacificoData
        ? [{ name: 'Pacifico', data: pacificoData, weight: 400, style: 'normal' }]
        : [],
    }
  )
}
