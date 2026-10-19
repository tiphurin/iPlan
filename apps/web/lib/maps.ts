/** Deep links that open the native map apps on iPhone; exact pins when coordinates are known. */
export function mapLinks(query: string, at?: { lat: number; lng: number }) {
  const q = encodeURIComponent(query)
  if (at) {
    const ll = `${at.lat},${at.lng}`
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${ll}`,
      apple: `https://maps.apple.com/?ll=${ll}&q=${q}`,
      naver: `https://map.naver.com/p/search/${q}`,
    }
  }
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
    naver: `https://map.naver.com/p/search/${q}`,
  }
}
