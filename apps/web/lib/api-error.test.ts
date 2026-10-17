import { describe, expect, it } from 'vitest'
import { toApiError } from './api-error'

describe('toApiError', () => {
  it('reads the shared error shape', async () => {
    const response = new Response(
      JSON.stringify({
        error: { code: 'VALIDATION_FAILED', message: 'Invalid', fields: { name: 'Required' } },
      }),
      { status: 422 },
    )
    const error = await toApiError(response)
    expect(error).toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 422,
      fields: { name: 'Required' },
    })
  })

  it('falls back to INTERNAL for unexpected bodies', async () => {
    const error = await toApiError(new Response('<html>', { status: 502 }))
    expect(error).toMatchObject({ code: 'INTERNAL', status: 502 })
  })
})
