'use client'

import { useState } from 'react'

interface Props {
  invoiceNumber: string
}

export default function PdfDownloadButton({ invoiceNumber }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    const element = document.getElementById('invoice-preview')
    if (!element) return

    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html2pdf = (await import('html2pdf.js')).default as any

      // The preview panel may be hidden (display:none) on mobile when the user
      // is on the Edit tab. html2pdf silently fails on hidden elements, so walk
      // up the DOM and temporarily force-show any ancestor that is display:none,
      // generate the PDF, then restore each one.
      const hiddenAncestors: { el: HTMLElement; original: string }[] = []
      let node: HTMLElement | null = element
      while (node) {
        if (getComputedStyle(node).display === 'none') {
          hiddenAncestors.push({ el: node, original: node.style.display })
          node.style.display = 'block'
        }
        node = node.parentElement
      }

      try {
        await html2pdf()
          .set({
            margin: 0.5,
            filename: `Invoice-${invoiceNumber}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
          })
          .from(element)
          .save()
      } finally {
        for (const { el, original } of hiddenAncestors) {
          el.style.display = original
        }
      }
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
    >
      {loading ? (
        <>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Generating PDF…
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </>
      )}
    </button>
  )
}
