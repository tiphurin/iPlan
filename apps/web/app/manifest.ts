import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'iPlan',
    short_name: 'iPlan',
    description: 'Plan trips, split costs and track monthly money.',
    start_url: '/',
    display: 'standalone',
    // Matches the dark app icon (iplan-icons/README.md) so the launch screen blends in.
    background_color: '#12161c',
    theme_color: '#12161c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
