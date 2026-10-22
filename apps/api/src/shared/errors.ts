import type { ErrorCode } from '@iplan/contracts'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Thrown by services; the error handler turns it into an ErrorResponse. */
export class AppError extends Error {
  override readonly name = 'AppError'

  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export const unauthorized = () => new AppError('UNAUTHORIZED', 401, 'Sign in required')
export const forbidden = (message = 'Not allowed') => new AppError('FORBIDDEN', 403, message)
export const notFound = (what: string) => new AppError('NOT_FOUND', 404, `${what} not found`)
export const conflict = (message: string) => new AppError('CONFLICT', 409, message)
/** Pool spending may never exceed what was put in. */
export const poolShort = () => new AppError('POOL_SHORT', 422, 'Not enough money in the pool')
export const validationFailed = (fields: Record<string, string>, message = 'Invalid input') =>
  new AppError('VALIDATION_FAILED', 422, message, fields)
