import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getClaudeAccountLabel } from '@/lib/claude-account-label'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import { getRepoIdFromWorktreeId } from '../../../../shared/worktree/id'

/** The switcher changes the global account; say when the open repo runs another one. */
export function ClaudeRepoAccountNote({
  accounts
}: {
  accounts: Pick<ClaudeRateLimitAccountsState, 'accounts'>
}): React.JSX.Element | null {
  const accountId = useAppStore((state) => {
    const repoId = state.activeWorktreeId ? getRepoIdFromWorktreeId(state.activeWorktreeId) : null
    return state.repos.find((repo) => repo.id === repoId)?.claudeAccountId ?? null
  })
  if (!accountId || !accounts.accounts.some((account) => account.id === accountId)) {
    return null
  }
  return (
    <div className="px-2 py-1.5 text-2xs text-muted-foreground">
      {translate(
        'auto.components.status.bar.ClaudeRepoAccountNote.repoUses',
        'This repo uses: {{name}}',
        { name: getClaudeAccountLabel(accounts, accountId) }
      )}
    </div>
  )
}
