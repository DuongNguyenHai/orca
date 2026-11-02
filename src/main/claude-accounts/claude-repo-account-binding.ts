import { getRepoExecutionHostId } from '../../shared/execution-host'
import type {
  ClaudeManagedAccount,
  ClaudeRepoAccountChange
} from '../../shared/managed-account-types'
import type { Repo } from '../../shared/repo-types'
import type { RepoHostTarget } from '../../shared/repo-host-identity'

export const CLAUDE_REPO_ACCOUNT_LOCAL_ONLY_MESSAGE =
  'Claude accounts can be set only for repos on this computer.'
export const CLAUDE_ACCOUNT_OTHER_RUNTIME_MESSAGE =
  'That Claude account belongs to a different runtime.'

/** Optional so stores without repos (tests, settings-only callers) still satisfy the account store. */
export type ClaudeRepoAccountStore = {
  getRepos?: () => Repo[]
  updateRepo?: (target: RepoHostTarget, updates: { claudeAccountId: string | null }) => Repo | null
}

export async function setClaudeRepoAccount(
  deps: {
    store: ClaudeRepoAccountStore
    requireAccount: (accountId: string) => ClaudeManagedAccount
    needsSignIn: (account: ClaudeManagedAccount) => boolean
    needsSignInMessage: string
    publishAll: () => Promise<void>
  },
  repoId: string,
  accountId: string | null
): Promise<ClaudeRepoAccountChange> {
  const { store } = deps
  const rows = (store.getRepos?.() ?? []).filter((entry) => entry.id === repoId)
  // Repo ids repeat across execution hosts; only the local row can be bound.
  const repo = rows.find((entry) => getRepoExecutionHostId(entry) === 'local')
  if (!repo || !store.updateRepo) {
    throw new Error(
      rows.length > 0 ? CLAUDE_REPO_ACCOUNT_LOCAL_ONLY_MESSAGE : 'That repo no longer exists.'
    )
  }
  if (accountId !== null) {
    const account = deps.requireAccount(accountId)
    if ((account.managedAuthRuntime ?? 'host') !== 'host') {
      throw new Error(CLAUDE_ACCOUNT_OTHER_RUNTIME_MESSAGE)
    }
    if (deps.needsSignIn(account)) {
      throw new Error(deps.needsSignInMessage)
    }
  }
  const previousAccountId = repo.claudeAccountId ?? null
  store.updateRepo(repo, { claudeAccountId: accountId })
  try {
    await deps.publishAll()
  } catch (error) {
    store.updateRepo(repo, { claudeAccountId: previousAccountId })
    await deps.publishAll().catch((rollbackError: unknown) => {
      console.warn('[claude-accounts] Rollback republish failed:', rollbackError)
    })
    throw error
  }
  return { repoId, previousAccountId, accountId }
}

/** Repos bound to a removed account fall back to the global account. */
export function clearClaudeRepoAccountBindings(
  store: ClaudeRepoAccountStore,
  accountId: string
): void {
  for (const repo of store.getRepos?.() ?? []) {
    if (repo.claudeAccountId === accountId && getRepoExecutionHostId(repo) === 'local') {
      store.updateRepo?.(repo, { claudeAccountId: null })
    }
  }
}
