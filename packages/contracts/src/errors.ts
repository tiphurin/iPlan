import { z } from 'zod'

/**
 * Every API error carries a stable code. The web app translates codes into the
 * user's language; messages are for developers and logs only.
 */
export const ErrorCode = z.enum([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
  'DEV_LOGIN_DISABLED',
  'DEMO_DATA_MISSING',
  'INVITE_INVALID',
  'OWNER_CANNOT_LEAVE',
  'BALANCE_NOT_SETTLED',
  'CANNOT_CHANGE_SELF',
  'ACCOUNT_PENDING',
  'FEATURE_DISABLED',
  'USER_NOT_FOUND',
  'PASSWORD_INVALID',
  'PASSWORD_CHANGE_REQUIRED',
  'SUPERADMIN_PROTECTED',
  'TOO_MANY_ATTEMPTS',
  'NOT_IN_CIRCLE',
  'INVITATION_GONE',
  'TRIP_CURRENCY_LOCKED',
  'TRIP_DATES_EXCLUDE_CONTENT',
  'POOL_SHORT',
])
export type ErrorCode = z.infer<typeof ErrorCode>

export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    /** Field-level problems for VALIDATION_FAILED: path → message. */
    fields: z.record(z.string(), z.string()).optional(),
  }),
})
export type ErrorResponse = z.infer<typeof ErrorResponse>
