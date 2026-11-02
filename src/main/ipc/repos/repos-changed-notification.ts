import type { BrowserWindow } from 'electron'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { wakeFolderRepoGitUpgradeWatch } from '../folder-repo-git-upgrade-wake'
import { scheduleCurrentWorktreeBaseDirectoryWatcherSync } from '../worktree-base-directory-watcher'

type RepoRemoteClientNotifier = Pick<OrcaRuntimeService, 'notifyReposChangedForRemoteClients'>

let repoRemoteClientNotifier: RepoRemoteClientNotifier | null = null

export function setRepoRemoteClientNotifier(notifier: RepoRemoteClientNotifier): void {
  repoRemoteClientNotifier = notifier
}

const reposChangedListeners = new Set<() => void>()

/** Main-process state derived from repos (e.g. Claude account pointers) refreshes here. */
export function addReposChangedListener(listener: () => void): () => void {
  reposChangedListeners.add(listener)
  return () => reposChangedListeners.delete(listener)
}

export function notifyReposChanged(mainWindow: BrowserWindow | null): void {
  wakeFolderRepoGitUpgradeWatch()
  for (const listener of reposChangedListeners) {
    try {
      listener()
    } catch (err) {
      console.error('[repos] repo change listener failed', err)
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('repos:changed')
  }
  // Paired clients refetch only on this event, including host-side deletes and renames (#11994).
  try {
    repoRemoteClientNotifier?.notifyReposChangedForRemoteClients()
  } catch (err) {
    // Broadcast failure must not reject an already committed mutation.
    console.error('[repos] failed to notify remote clients of repo change', err)
  }
  scheduleCurrentWorktreeBaseDirectoryWatcherSync()
}
