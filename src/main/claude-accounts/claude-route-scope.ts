import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'
import { parsePaneKey } from '../../shared/stable-pane-id'
import type { ClaudeRouteScope } from './claude-repo-route-bindings'

/** Terminals without a workspace follow the global Claude account. */
export function claudeRouteScopeForWorktree(worktreeId: string | undefined): ClaudeRouteScope {
  return worktreeId ? { repoId: getRepoIdFromWorktreeId(worktreeId) } : {}
}

/** An agent-teams leader is addressed by pane key; its leaf names the workspace. */
export function claudeRouteScopeForPaneKey(
  paneKey: string,
  worktreeIdForLeaf: (tabId: string, leafId: string) => string | undefined
): ClaudeRouteScope {
  const pane = parsePaneKey(paneKey)
  return claudeRouteScopeForWorktree(pane ? worktreeIdForLeaf(pane.tabId, pane.leafId) : undefined)
}
