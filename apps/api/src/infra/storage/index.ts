import type { ApiEnv } from '../../env'
import { LocalDiskStorage } from './local'
import { S3Storage } from './s3'
import type { StorageProvider } from './storage'

export type { StorageProvider } from './storage'

export function createStorage(env: ApiEnv): StorageProvider {
  return env.storage.driver === 's3'
    ? new S3Storage(env.storage.s3)
    : new LocalDiskStorage(env.storage.localDir)
}
