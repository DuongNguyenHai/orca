import { getRepoExecutionHostId } from '../../../shared/execution-host'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import type { Repo } from '../../../shared/repo-types'

/** Mirrors the main-process router: only a local row bound to a known host account counts. */
export function boundClaudeAccountIdForRepo(
  repos: readonly Repo[],
  accounts: readonly Pick<ClaudeManagedAccount, 'id' | 'managedAuthRuntime'>[],
  repoId: string | null
): string | null {
  const accountId = repos.find(
    (repo) => repo.id === repoId && getRepoExecutionHostId(repo) === 'local'
  )?.claudeAccountId
  const account = accounts.find((entry) => entry.id === accountId)
  return account && account.managedAuthRuntime !== 'wsl' ? account.id : null
}
