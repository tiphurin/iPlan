import { OpenAPIHono } from '@hono/zod-openapi'
import { ErrorResponse } from '@iplan/contracts'
import type { AppEnv } from './context'
import { validationFailed } from './errors'

/** Router whose request validation failures use the shared VALIDATION_FAILED shape. */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        const fields: Record<string, string> = {}
        for (const issue of result.error.issues) {
          fields[issue.path.join('.') || '_'] = issue.message
        }
        throw validationFailed(fields)
      }
    },
  })
}

const json = { 'application/json': { schema: ErrorResponse } }

export const errorResponses = {
  401: { description: 'Not signed in', content: json },
  403: { description: 'Not allowed', content: json },
  404: { description: 'Not found', content: json },
  422: { description: 'Invalid input', content: json },
} as const
