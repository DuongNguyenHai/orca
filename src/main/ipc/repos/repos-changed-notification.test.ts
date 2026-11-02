import { describe, expect, it, vi } from 'vitest'

vi.mock('../folder-repo-git-upgrade-wake', () => ({ wakeFolderRepoGitUpgradeWatch: vi.fn() }))
vi.mock('../worktree-base-directory-watcher', () => ({
  scheduleCurrentWorktreeBaseDirectoryWatcherSync: vi.fn()
}))

import { addReposChangedListener, notifyReposChanged } from './repos-changed-notification'

describe('notifyReposChanged', () => {
  it('tells main-process listeners that repos changed', () => {
    const listener = vi.fn()
    const remove = addReposChangedListener(listener)
    notifyReposChanged(null)
    expect(listener).toHaveBeenCalledOnce()
    remove()
    notifyReposChanged(null)
    expect(listener).toHaveBeenCalledOnce()
  })
})
