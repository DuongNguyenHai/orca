import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../shared/constants'
import { ClaudeProfileRouter } from '../claude-accounts/claude-profile-router'
import { installClaudeProfileRouter } from '../claude-accounts/claude-profile-installed-router'
import { resolveStructuredClaudeAccountHomePath } from '../runtime/structured-agent-account-home'
import { prepareClaudeLaunchAccount } from './claude-launch-account'

vi.mock('../claude/agent-view/agent-view-service', () => ({
  getClaudeAgentViewService: () => ({ prepareProfile: async () => {} })
}))

const roots: string[] = []
afterEach(() => {
  installClaudeProfileRouter(undefined)
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
})

function boundRouter() {
  const dataRoot = mkdtempSync(join(tmpdir(), 'claude-launch-account-'))
  roots.push(dataRoot)
  const account = (id: string) => ({
    id,
    email: `${id}@example.test`,
    authMethod: 'subscription-oauth' as const,
    managedAuthPath: '/unused-legacy',
    createdAt: 0,
    updatedAt: 0,
    lastAuthenticatedAt: 0
  })
  const settings = {
    ...getDefaultSettings('/tmp'),
    claudeManagedAccounts: [account('a'), account('b')],
    activeClaudeManagedAccountId: 'a',
    activeClaudeManagedAccountIdsByRuntime: { host: 'a', wsl: {} },
    agentStatusHooksEnabled: false
  }
  const home = (id: string) => join(dataRoot, 'claude-profiles', id, 'home')
  mkdirSync(home('a'), { recursive: true })
  mkdirSync(home('b'), { recursive: true })
  const router = new ClaudeProfileRouter({
    getSettings: () => settings,
    dataRoot,
    userHome: join(dataRoot, 'personal'),
    env: {},
    runSetup: async () => ({ outcome: 'prepared', warnings: [], surfaces: {} }),
    getRepoClaudeAccountId: (repoId) => (repoId === 'r1' ? 'b' : undefined),
    listBoundRepoIds: () => ['r1']
  })
  installClaudeProfileRouter(router)
  return { router, home }
}

describe('repo-scoped Claude chat launches', () => {
  it('prepareClaudeLaunchAccount uses the repo account', async () => {
    const { router, home } = boundRouter()
    const env: Record<string, string> = {}
    const recipe = await prepareClaudeLaunchAccount(router, env, home('a'), { repoId: 'r1' })
    expect(recipe).toMatchObject({ route: 'managed', accountId: 'b' })
    expect(env.CLAUDE_CONFIG_DIR).toBe(home('b'))
  })

  it('resolveStructuredClaudeAccountHomePath with scope returns the bound home', async () => {
    const { home } = boundRouter()
    const resolve = (scope?: { repoId?: string }) =>
      resolveStructuredClaudeAccountHomePath({
        launchEnv: {},
        wslDistro: null,
        getClaudeConfigDirectory: () => null,
        ...(scope ? { scope } : {})
      })
    await expect(resolve({ repoId: 'r1' })).resolves.toBe(home('b'))
    await expect(resolve()).resolves.toBe(home('a'))
  })
})
