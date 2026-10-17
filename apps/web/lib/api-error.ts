import { type ErrorCode, ErrorResponse } from '@iplan/contracts'

/** An API failure with the stable code the UI translates (errors.<CODE>). */
export class ApiError extends Error {
  override readonly name = 'ApiError'

  constructor(
    readonly code: ErrorCode | 'NETWORK',
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message)
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const parsed = ErrorResponse.safeParse(await response.json().catch(() => null))
  if (parsed.success) {
    const { code, message, fields } = parsed.data.error
    return new ApiError(code, response.status, message, fields)
  }
  return new ApiError('INTERNAL', response.status, `HTTP ${response.status}`)
}
