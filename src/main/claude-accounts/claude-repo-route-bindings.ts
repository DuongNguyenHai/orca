import type { GlobalSettings } from '../../shared/global-settings-types'
import { rmSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  claudeRepoPointerPath,
  removeStaleClaudeRepoPointers,
  writeClaudePointerFile
} from './claude-profile-pointer-files'
import { findClaudeAccount } from './runtime-selection'

/** Absent repoId routes by the global selection. */
export type ClaudeRouteScope = { repoId?: string }

export type ClaudeRepoBindingSource = {
  /** Local repos only; the caller filters out remote repos. */
  getRepoClaudeAccountId?: (repoId: string) => string | undefined
  listBoundRepoIds?: () => string[]
}

/** Resolves a repo's Claude account and pointer; anything unresolvable follows the global route. */
export class ClaudeRepoRouteBindings {
  constructor(
    private readonly args: ClaudeRepoBindingSource & {
      getSettings: () => Pick<GlobalSettings, 'claudeManagedAccounts'>
      globalPointerPath: string
    }
  ) {}

  /** An unknown or WSL account follows the global selection. */
  boundAccountId(scope: ClaudeRouteScope | undefined): string | null {
    const id = scope?.repoId ? this.args.getRepoClaudeAccountId?.(scope.repoId) : undefined
    const account = id ? findClaudeAccount(this.args.getSettings(), id) : undefined
    return account && account.managedAuthRuntime !== 'wsl' ? account.id : null
  }

  pointerFor(scope: ClaudeRouteScope | undefined): string {
    return scope?.repoId && this.boundAccountId(scope)
      ? claudeRepoPointerPath(this.args.globalPointerPath, scope.repoId)
      : this.args.globalPointerPath
  }

  boundScopes(): ClaudeRouteScope[] {
    return (this.args.listBoundRepoIds?.() ?? [])
      .map((repoId) => ({ repoId }))
      .filter((scope) => this.boundAccountId(scope) !== null)
  }

  /** No accounts removes the pointer so shells fall back to the user's own config. */
  writePointer(scope: ClaudeRouteScope | undefined, home: string): boolean {
    const path = this.pointerFor(scope)
    if (this.args.getSettings().claudeManagedAccounts.length === 0) {
      rmSync(path, { force: true })
      return false
    }
    writeClaudePointerFile(path, home)
    return true
  }

  /** Writes the global pointer and every bound repo pointer, and removes stale repo pointers. */
  writeAllPointers(homeFor: (scope: ClaudeRouteScope) => string): boolean {
    const written = this.writePointer({}, homeFor({}))
    const keep = new Set<string>()
    if (written) {
      for (const scope of this.boundScopes()) {
        this.writePointer(scope, homeFor(scope))
        keep.add(this.pointerFor(scope))
      }
    }
    removeStaleClaudeRepoPointers(dirname(this.args.globalPointerPath), keep)
    return written
  }
}
