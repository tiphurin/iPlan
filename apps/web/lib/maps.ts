/** Deep links that open the native map apps on iPhone. */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query)
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
  }
}
