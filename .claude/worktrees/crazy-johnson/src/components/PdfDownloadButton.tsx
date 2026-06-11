'use client'

import { useEffect } from 'react'

interface Props {
  invoiceNumber: string
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2pdf: any
  }
}

export default function PdfDownloadButton({ invoiceNumber }: Props) {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
    script.async = true
    document.head.appendChild(script)
    return () => {
      document.head.removeChild(script)
    }
  }, [])

  function handleDownload() {
    const element = document.getElementById('invoice-preview')
    if (!element) return

    if (typeof window.html2pdf === 'undefined') {
      alert('PDF library is still loading. Please try again in a moment.')
      return
    }

    window.html2pdf()
      .set({
        margin: 0.5,
        filename: `Invoice-${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save()
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Download PDF
    </button>
  )
}
