import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, switchToWorktree } from './helpers/store'
import {
  execInTerminal,
  getTerminalContent,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'

// A fake `claude` that only reports which account folder Orca's shell function chose.
const fakeBin = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-fake-claude-')))
writeFileSync(path.join(fakeBin, 'claude.cmd'), '@echo ORCA_PROBE=[%CLAUDE_CONFIG_DIR%]\r\n')
writeFileSync(path.join(fakeBin, 'claude'), '#!/bin/sh\necho "ORCA_PROBE=[$CLAUDE_CONFIG_DIR]"\n', {
  mode: 0o755
})

test.use({ launchEnv: { PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` } })

const account = (id: string) => ({
  id,
  email: `${id}@example.test`,
  managedAuthPath: '',
  managedAuthRuntime: 'host' as const,
  wslDistro: null,
  authMethod: 'subscription-oauth' as const,
  createdAt: 1,
  updatedAt: 1,
  lastAuthenticatedAt: 1
})

async function probe(page: Page, ptyId: string, marker: string): Promise<string> {
  await execInTerminal(page, ptyId, `echo ${marker}; claude`)
  let seen = ''
  await expect
    .poll(
      async () => {
        const content = await getTerminalContent(page, 20_000)
        const tail = content.slice(content.lastIndexOf(marker))
        seen = /ORCA_PROBE=\[([^\]]*)\]/.exec(tail)?.[1] ?? ''
        return seen
      },
      { timeout: 20_000 }
    )
    .not.toBe('')
  return seen.trim()
}

test('a repo bound to a Claude account routes its terminals to that account', async ({
  electronApp,
  orcaPage: page,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  registerPostElectronShutdownCleanup(async () => rmSync(fakeBin, { recursive: true, force: true }))
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const home = (id: string) => path.join(userData, 'claude-profiles', id, 'home')
  for (const id of ['work', 'personal']) {
    mkdirSync(home(id), { recursive: true })
    writeFileSync(
      path.join(home(id), '.claude.json'),
      JSON.stringify({ oauthAccount: { emailAddress: `${id}@example.test` } })
    )
  }
  await page.evaluate(
    async (accounts) => {
      await window.api.settings.set({ claudeManagedAccounts: accounts })
      await window.api.claudeAccounts.select({ accountId: 'personal' })
    },
    [account('work'), account('personal')]
  )

  const worktreeA = await waitForActiveWorktree(page)
  const repoA = worktreeA.split('::')[0]
  await ensureTerminalVisible(page, 30_000)
  await waitForActiveTerminalManager(page, 30_000)
  const ptyA = await waitForActivePanePtyId(page, 30_000)

  // 1. Unbound repo follows the global account.
  expect(await probe(page, ptyA, 'STEP1')).toBe(home('personal'))

  // 2. Binding while the terminal is open: the next `claude` in that same shell switches.
  await page.evaluate(
    (repoId) => window.api.claudeAccounts.setRepoAccount({ repoId, accountId: 'work' }),
    repoA
  )
  expect(await probe(page, ptyA, 'STEP2')).toBe(home('work'))

  // 3. Unbinding returns that shell to the global account.
  await page.evaluate(
    (repoId) => window.api.claudeAccounts.setRepoAccount({ repoId, accountId: null }),
    repoA
  )
  expect(await probe(page, ptyA, 'STEP3')).toBe(home('personal'))

  // 4. Rebind A, then a second repo B keeps the global account in its own terminal.
  await page.evaluate(
    (repoId) => window.api.claudeAccounts.setRepoAccount({ repoId, accountId: 'work' }),
    repoA
  )
  const repoBPath = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'orca-e2e-repo-b-')))
  registerPostElectronShutdownCleanup(async () =>
    rmSync(repoBPath, { recursive: true, force: true })
  )
  execFileSync('git', ['init'], { cwd: repoBPath, stdio: 'pipe' })
  execFileSync(
    'git',
    [
      '-c',
      'user.email=e2e@test.local',
      '-c',
      'user.name=E2E',
      'commit',
      '--allow-empty',
      '-m',
      'init'
    ],
    {
      cwd: repoBPath,
      stdio: 'pipe'
    }
  )
  const worktreeB = await page.evaluate(async (repoPath) => {
    const result = await window.api.repos.add({ path: repoPath })
    if ('error' in result) {
      throw new Error(result.error)
    }
    const store = window.__store!
    await store.getState().fetchRepos({ runtimeEnvironmentId: null, throwOnError: true })
    await store.getState().fetchWorktrees(result.repo.id)
    return store.getState().worktreesByRepo[result.repo.id]?.[0]?.id ?? null
  }, repoBPath)
  expect(worktreeB).toBeTruthy()
  await switchToWorktree(page, worktreeB!)
  await ensureTerminalVisible(page, 30_000)
  const ptyB = await waitForActivePanePtyId(page, 30_000)
  expect(ptyB).not.toBe(ptyA)
  expect(await probe(page, ptyB, 'STEP4B')).toBe(home('personal'))

  await switchToWorktree(page, worktreeA)
  const ptyA2 = await waitForActivePanePtyId(page, 30_000)
  expect(await probe(page, ptyA2, 'STEP4A')).toBe(home('work'))

  // 5. The repo settings section shows the binding.
  await page.evaluate((repoId) => {
    const store = window.__store!.getState()
    store.openSettingsPage()
    store.openSettingsTarget({ pane: 'repo', repoId })
  }, repoA)
  const section = page.getByText('Claude account', { exact: true }).first()
  await expect(section).toBeVisible({ timeout: 20_000 })
  await section.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('repo-claude-account-settings.png') })
})
