import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../shared/repo-types'
import { hydrateRepo } from './repo-hydration'

const repo = (overrides: Partial<Repo>): Repo => ({
  id: 'r1',
  path: '/repo',
  displayName: 'repo',
  badgeColor: '#000000',
  addedAt: 0,
  ...overrides
})

describe('hydrateRepo claudeAccountId', () => {
  it('hydration keeps a non-empty claudeAccountId on a local repo', () => {
    expect(hydrateRepo(repo({ claudeAccountId: 'acc-1' }), new Map()).claudeAccountId).toBe('acc-1')
  })

  it('hydration drops claudeAccountId on an SSH repo', () => {
    const hydrated = hydrateRepo(
      repo({ claudeAccountId: 'acc-1', connectionId: 'ssh-1' }),
      new Map()
    )
    expect(hydrated.claudeAccountId).toBeUndefined()
  })

  it('hydration drops an empty claudeAccountId', () => {
    expect(hydrateRepo(repo({ claudeAccountId: '' }), new Map()).claudeAccountId).toBeUndefined()
  })
})
