interface VortaliLogoProps {
  /** 'lockup' = badge + wordmark (default). 'badge' = icon only. */
  variant?: 'lockup' | 'badge'
  /** Height in px. Width scales proportionally. Default: 36 */
  height?: number
  /** Text fill for the wordmark. Default: currentColor so it inherits from CSS. */
  textColor?: string
  className?: string
}

export default function VortaliLogo({
  variant = 'lockup',
  height = 36,
  textColor = 'currentColor',
  className,
}: VortaliLogoProps) {
  // Badge-only icon: viewBox 56×56
  if (variant === 'badge') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 56 56"
        height={height}
        width={height}
        fill="none"
        aria-label="Vortali"
        role="img"
        className={className}
      >
        <defs>
          <linearGradient id="vl-badge-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#3730A3" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="54" height="54" rx="16" fill="url(#vl-badge-g)" />
        <polyline
          points="9,22 28,44 47,22"
          fill="none"
          stroke="#C7D2FE"
          strokeWidth="7.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // Full lockup: badge + "ortali" in Pacifico. viewBox 258×82.
  // Scale: height prop controls rendered height; width scales from aspect ratio 258/82 ≈ 3.146
  const width = Math.round(height * (258 / 82))

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 258 82"
      height={height}
      width={width}
      fill="none"
      aria-label="Vortali"
      role="img"
      className={className}
    >
      <defs>
        <linearGradient id="vl-lockup-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3730A3" />
        </linearGradient>
      </defs>
      {/* Badge */}
      <rect x="1" y="14" width="54" height="54" rx="16" fill="url(#vl-lockup-g)" />
      {/* V mark */}
      <polyline
        points="9,35 28,57 47,35"
        fill="none"
        stroke="#C7D2FE"
        strokeWidth="7.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Wordmark */}
      <text
        x="63"
        y="57"
        style={{ fontFamily: 'var(--font-pacifico, "Pacifico", cursive)' }}
        fontSize="48"
        fill={textColor}
      >
        ortali
      </text>
    </svg>
  )
}
