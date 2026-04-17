'use client'

interface Props {
  logoUrl: string
  opacity: number // 5–20
}

export default function InvoiceWatermark({ logoUrl, opacity }: Props) {
  return (
    <div
      className="invoice-watermark"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: opacity / 100,
        pointerEvents: 'none',
        zIndex: 0,
        width: '55%',
        maxWidth: '400px',
      }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
