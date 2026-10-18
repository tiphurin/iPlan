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
        background: '#4f46e5',
      }}
    >
      <svg width="110" height="110" viewBox="0 0 64 64">
        <path
          d="M32 14c-7.2 0-13 5.6-13 12.6C19 36 32 50 32 50s13-14 13-23.4C45 19.6 39.2 14 32 14z"
          fill="#fff"
        />
        <circle cx="32" cy="27" r="5" fill="#4f46e5" />
      </svg>
    </div>,
    size,
  )
}
