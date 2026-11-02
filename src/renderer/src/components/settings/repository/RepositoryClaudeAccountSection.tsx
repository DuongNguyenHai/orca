import { useEffect, useId, useState } from 'react'
import type { Repo } from '../../../../../shared/repo-types'
import type { ClaudeRateLimitAccountsState } from '../../../../../shared/managed-account-types'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { SearchableSetting } from '../SearchableSetting'
import { searchKeywords } from '../settings-search-keywords'
import { translate } from '@/i18n/i18n'
import { getClaudeAccountLabel } from '@/lib/claude-account-label'
import { handleRunningClaudeSessionsAfterRepoRebind } from '@/lib/claude-account-switch-sessions'

// Radix forbids empty item values; this sentinel means "follow the global account".
const FOLLOW_GLOBAL_VALUE = '__follow_global_claude_account__'

export function RepositoryClaudeAccountSection({
  repo,
  forceVisible
}: {
  repo: Repo
  forceVisible?: boolean
}): React.JSX.Element | null {
  const [state, setState] = useState<ClaudeRateLimitAccountsState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectLabelId = useId()

  useEffect(() => {
    let cancelled = false
    void window.api.claudeAccounts
      .list()
      .then((next) => {
        if (!cancelled) {
          setState(next)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [repo.claudeAccountId])

  const hostAccounts = (state?.accounts ?? []).filter(
    (account) => (account.managedAuthRuntime ?? 'host') === 'host'
  )
  if (!state || (hostAccounts.length === 0 && !repo.claudeAccountId)) {
    return null
  }
  const isLocal = getRepoExecutionHostId(repo) === 'local'
  const globalAccountId = state.activeAccountIdsByRuntime?.host ?? state.activeAccountId ?? null

  const applyAccount = async (accountId: string | null): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const change = await window.api.claudeAccounts.setRepoAccount({ repoId: repo.id, accountId })
      void handleRunningClaudeSessionsAfterRepoRebind({ change, accounts: state })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const title = translate(
    'auto.components.settings.RepositoryClaudeAccountSection.title',
    'Claude account'
  )
  return (
    <SearchableSetting
      title={title}
      description={translate(
        'auto.components.settings.RepositoryClaudeAccountSection.footnote',
        "Applies to new Claude launches in this repo's terminals."
      )}
      keywords={searchKeywords([repo.displayName, 'claude', 'claude account', 'account'])}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="space-y-1.5">
        <span id={selectLabelId} className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryClaudeAccountSection.selectLabel',
            'Account'
          )}
        </span>
        <Select
          value={repo.claudeAccountId ?? FOLLOW_GLOBAL_VALUE}
          disabled={!isLocal || saving}
          onValueChange={(value) => {
            const next = value === FOLLOW_GLOBAL_VALUE ? null : value
            if (next !== (repo.claudeAccountId ?? null)) {
              void applyAccount(next)
            }
          }}
        >
          <SelectTrigger size="sm" className="w-full" aria-labelledby={selectLabelId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FOLLOW_GLOBAL_VALUE}>
              {translate(
                'auto.components.settings.RepositoryClaudeAccountSection.followGlobal',
                'Follow global account ({{name}})',
                { name: getClaudeAccountLabel(state, globalAccountId) }
              )}
            </SelectItem>
            {hostAccounts.map((account) => (
              <SelectItem
                key={account.id}
                value={account.id}
                disabled={account.needsSignIn === true}
              >
                {getClaudeAccountLabel(state, account.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        {isLocal
          ? translate(
              'auto.components.settings.RepositoryClaudeAccountSection.footnoteWsl',
              "Applies to new Claude launches in this repo's terminals. Repos running in WSL use the WSL Claude account."
            )
          : translate(
              'auto.components.settings.RepositoryClaudeAccountSection.localOnly',
              'Available only for repos on this computer.'
            )}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </SearchableSetting>
  )
}
