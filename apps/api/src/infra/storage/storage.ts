/** Where attachment bytes live. Keys are opaque paths; nothing is ever public. */
export interface StorageProvider {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>
  /** Bytes for streaming through the API (local driver). */
  get(key: string): Promise<Uint8Array<ArrayBuffer> | null>
  /** Short-lived direct download URL, when the backend supports it (S3). */
  signedUrl?(key: string, ttlSeconds: number): Promise<string>
  delete(key: string): Promise<void>
}
