import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Home-screen icon for iPhone (iOS ignores SVG icons). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#14171d',
      }}
    >
      <svg width="140" height="140" viewBox="0 0 64 64">
        <path d="M32 6v13M32 45v13" stroke="#00a84d" strokeWidth="6" strokeLinecap="round" />
        <circle cx="32" cy="32" r="11" fill="#fff" stroke="#00a84d" strokeWidth="6" />
      </svg>
    </div>,
    size,
  )
}
