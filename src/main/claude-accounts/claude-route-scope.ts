import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'
import type { ClaudeRouteScope } from './claude-repo-route-bindings'

/** Terminals without a workspace follow the global Claude account. */
export function claudeRouteScopeForWorktree(worktreeId: string | undefined): ClaudeRouteScope {
  return worktreeId ? { repoId: getRepoIdFromWorktreeId(worktreeId) } : {}
}
