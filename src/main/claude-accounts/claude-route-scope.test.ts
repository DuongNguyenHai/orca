import { describe, expect, it } from 'vitest'
import { claudeRouteScopeForWorktree } from './claude-route-scope'

describe('claudeRouteScopeForWorktree', () => {
  it('returns the repo of a worktree id', () => {
    expect(claudeRouteScopeForWorktree('r1::C:/repo')).toEqual({ repoId: 'r1' })
  })

  it('returns the global scope without a worktree id', () => {
    expect(claudeRouteScopeForWorktree(undefined)).toEqual({})
    expect(claudeRouteScopeForWorktree('')).toEqual({})
  })
})
