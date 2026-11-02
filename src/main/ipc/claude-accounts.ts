import { BrowserWindow, ipcMain } from 'electron'
import type { ClaudeAccountService } from '../claude-accounts/service'
import type { ClaudeAccountSelectionTarget } from '../claude-accounts/runtime-selection'
import { openAccountSignInLink } from './account-sign-in-link-opener'
import { notifyReposChanged } from './repos/repos-changed-notification'

export function registerClaudeAccountHandlers(claudeAccounts: ClaudeAccountService): void {
  claudeAccounts.setWslSignInLinkOpener((signInLink) => openAccountSignInLink('claude', signInLink))
  ipcMain.handle('claudeAccounts:list', () => claudeAccounts.listAccounts())
  ipcMain.handle(
    'claudeAccounts:add',
    (_event, args?: ClaudeAccountSelectionTarget & { copyLink?: boolean }) =>
      claudeAccounts.addAccount(args, args?.copyLink)
  )
  ipcMain.handle('claudeAccounts:cancelPendingLogin', () => claudeAccounts.cancelPendingLogin())
  ipcMain.handle(
    'claudeAccounts:reauthenticate',
    (_event, args: { accountId: string; copyLink?: boolean }) =>
      claudeAccounts.reauthenticateAccount(args.accountId, args.copyLink)
  )
  ipcMain.handle('claudeAccounts:waitForSignInLink', () => claudeAccounts.waitForSignInLink())
  ipcMain.handle('claudeAccounts:remove', async (event, args: { accountId: string }) => {
    const state = await claudeAccounts.removeAccount(args.accountId)
    // Removing an account can clear repo bindings.
    notifyReposChanged(BrowserWindow.fromWebContents(event.sender))
    return state
  })
  ipcMain.handle(
    'claudeAccounts:setRepoAccount',
    async (event, args: { repoId: string; accountId: string | null }) => {
      const change = await claudeAccounts.setRepoAccount(args.repoId, args.accountId)
      notifyReposChanged(BrowserWindow.fromWebContents(event.sender))
      return change
    }
  )
  ipcMain.handle(
    'claudeAccounts:select',
    (_event, args: { accountId: string | null } & ClaudeAccountSelectionTarget) =>
      args.runtime
        ? claudeAccounts.selectAccountForTarget(args.accountId, args)
        : claudeAccounts.selectAccount(args.accountId)
  )
}
