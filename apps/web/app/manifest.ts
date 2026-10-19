import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'iPlan',
    short_name: 'iPlan',
    description: 'Plan trips, split costs and track monthly money.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f4f7',
    theme_color: '#14171d',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
