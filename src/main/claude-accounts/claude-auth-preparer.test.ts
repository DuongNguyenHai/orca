import { describe, expect, it, vi } from 'vitest'
import { claudeAuthPreparer } from './claude-auth-preparer'

describe('claudeAuthPreparer', () => {
  it('forwards the repo scope to the launch preparation', async () => {
    const prepareForClaudeLaunch = vi.fn(async () => ({
      configDir: '',
      envPatch: {},
      provenance: 'system' as const
    }))
    await claudeAuthPreparer(() => ({ prepareForClaudeLaunch }))(
      { runtime: 'host' },
      { repoId: 'r1' }
    )
    expect(prepareForClaudeLaunch).toHaveBeenCalledWith({ runtime: 'host' }, { repoId: 'r1' })
  })
})
