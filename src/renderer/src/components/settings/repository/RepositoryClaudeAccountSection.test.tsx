// @vitest-environment happy-dom

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../../shared/repo-types'
import type { ClaudeRateLimitAccountsState } from '../../../../../shared/managed-account-types'
import { RepositoryClaudeAccountSection } from './RepositoryClaudeAccountSection'

const { rebindMock, storeState } = vi.hoisted(() => ({
  rebindMock: vi.fn(async () => 'handled' as const),
  storeState: { settingsSearchQuery: '' }
}))

vi.mock('@/store/index', () => {
  const useAppStore = (selector: (state: typeof storeState) => unknown) => selector(storeState)
  useAppStore.getState = () => storeState
  return { useAppStore }
})

vi.mock('@/lib/claude-account-switch-sessions', () => ({
  handleRunningClaudeSessionsAfterRepoRebind: rebindMock
}))

// Why: Radix Select needs pointer/layout APIs happy-dom lacks; a native select keeps value + disabled testable.
vi.mock('../../ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children
  }: {
    value: string
    onValueChange: (value: string) => void
    disabled?: boolean
    children: React.ReactNode
  }) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    disabled,
    children
  }: {
    value: string
    disabled?: boolean
    children: React.ReactNode
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  )
}))

const row = (
  id: string,
  extra: Partial<ClaudeRateLimitAccountsState['accounts'][number]> = {}
) => ({
  id,
  email: `${id}@example.test`,
  managedAuthRuntime: 'host' as const,
  wslDistro: null,
  authMethod: 'subscription-oauth' as const,
  createdAt: 1,
  updatedAt: 1,
  lastAuthenticatedAt: 1,
  ...extra
})

function accountsState(
  accounts: ClaudeRateLimitAccountsState['accounts']
): ClaudeRateLimitAccountsState {
  return { accounts, activeAccountId: 'a', activeAccountIdsByRuntime: { host: 'a', wsl: {} } }
}

const repo = (extra: Partial<Repo> = {}): Repo => ({
  id: 'r1',
  path: '/r1',
  displayName: 'r1',
  badgeColor: '#000',
  addedAt: 0,
  ...extra
})

let container: HTMLDivElement
let root: Root
const listMock = vi.fn()
const setRepoAccountMock = vi.fn()

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.clearAllMocks()
  Object.assign(window, {
    api: { claudeAccounts: { list: listMock, setRepoAccount: setRepoAccountMock } }
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(target: Repo): Promise<void> {
  await act(async () => {
    root.render(<RepositoryClaudeAccountSection repo={target} forceVisible />)
  })
}

describe('RepositoryClaudeAccountSection', () => {
  it('hidden when there are no Claude accounts', async () => {
    listMock.mockResolvedValue(accountsState([]))
    await render(repo())
    expect(container.querySelector('select')).toBeNull()
  })

  it('lists host accounts only and selects the current binding', async () => {
    listMock.mockResolvedValue(
      accountsState([row('a'), row('b'), row('w', { managedAuthRuntime: 'wsl', wslDistro: 'U' })])
    )
    await render(repo({ claudeAccountId: 'b' }))
    const select = container.querySelector('select')!
    const values = [...select.options].map((option) => option.value)
    expect(values).toContain('a')
    expect(values).toContain('b')
    expect(values).not.toContain('w')
    expect(select.value).toBe('b')
  })

  it('choosing an account calls setRepoAccount and then the rebind handler', async () => {
    const state = accountsState([row('a'), row('b')])
    listMock.mockResolvedValue(state)
    const change = { repoId: 'r1', previousAccountId: null, accountId: 'b' }
    setRepoAccountMock.mockResolvedValue(change)
    await render(repo())
    const select = container.querySelector('select')!
    await act(async () => {
      select.value = 'b'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(setRepoAccountMock).toHaveBeenCalledWith({ repoId: 'r1', accountId: 'b' })
    expect(rebindMock).toHaveBeenCalledWith({ change, accounts: state })
  })

  it('disabled with the SSH reason for a repo with connectionId', async () => {
    listMock.mockResolvedValue(accountsState([row('a')]))
    await render(repo({ connectionId: 'ssh-1' }))
    expect(container.querySelector('select')?.disabled).toBe(true)
    expect(container.textContent).toContain('Available only for repos on this computer.')
  })
})
