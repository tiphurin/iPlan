import { AwsClient } from 'aws4fetch'
import type { StorageProvider } from './storage'

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
}

/** Any S3-compatible bucket (Backblaze B2 in production, MinIO if you prefer locally). */
export class S3Storage implements StorageProvider {
  private readonly client: AwsClient

  constructor(private readonly config: S3Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: config.region,
    })
  }

  private url(key: string): string {
    const endpoint = new URL(this.config.endpoint)
    const path = key.split('/').map(encodeURIComponent).join('/')
    if (this.config.forcePathStyle) return `${endpoint.origin}/${this.config.bucket}/${path}`
    return `${endpoint.protocol}//${this.config.bucket}.${endpoint.host}/${path}`
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'content-type': contentType },
    })
    if (!res.ok) throw new Error(`S3 put failed: ${res.status} ${await res.text()}`)
  }

  async get(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const res = await this.client.fetch(this.url(key))
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`S3 get failed: ${res.status}`)
    return new Uint8Array(await res.arrayBuffer())
  }

  async signedUrl(key: string, ttlSeconds: number): Promise<string> {
    const signed = await this.client.sign(
      new Request(`${this.url(key)}?X-Amz-Expires=${ttlSeconds}`),
      {
        aws: { signQuery: true },
      },
    )
    return signed.url
  }

  async delete(key: string): Promise<void> {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`S3 delete failed: ${res.status}`)
  }
}
