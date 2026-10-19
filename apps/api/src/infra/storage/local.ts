import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { StorageProvider } from './storage'

/** Development driver: files under a local folder (default ./.data/uploads). */
export class LocalDiskStorage implements StorageProvider {
  private readonly root: string

  constructor(root: string) {
    this.root = resolve(root)
  }

  private path(key: string): string {
    const full = resolve(join(this.root, key))
    // Keys come from the server, but never let one escape the root.
    if (!full.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`)
    return full
  }

  async put(key: string, body: Uint8Array): Promise<void> {
    const path = this.path(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
  }

  async get(key: string): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
      return new Uint8Array(await readFile(this.path(key)))
    } catch {
      return null
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true })
  }
}
