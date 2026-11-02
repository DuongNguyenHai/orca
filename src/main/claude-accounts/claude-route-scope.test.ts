import { describe, expect, it } from 'vitest'
import { claudeRouteScopeForPaneKey, claudeRouteScopeForWorktree } from './claude-route-scope'

describe('claudeRouteScopeForWorktree', () => {
  it('returns the repo of a worktree id', () => {
    expect(claudeRouteScopeForWorktree('r1::C:/repo')).toEqual({ repoId: 'r1' })
  })

  it('returns the global scope without a worktree id', () => {
    expect(claudeRouteScopeForWorktree(undefined)).toEqual({})
    expect(claudeRouteScopeForWorktree('')).toEqual({})
  })

  it("scopes an agent-teams leader pane to its leaf's repo", () => {
    const leaf = '11111111-1111-4111-8111-111111111111'
    const worktreeOf = (tabId: string, leafId: string) =>
      tabId === 'tab-1' && leafId === leaf ? 'r1::C:/repo' : undefined
    expect(claudeRouteScopeForPaneKey(`tab-1:${leaf}`, worktreeOf)).toEqual({ repoId: 'r1' })
    expect(claudeRouteScopeForPaneKey('not-a-pane-key', worktreeOf)).toEqual({})
  })
})
