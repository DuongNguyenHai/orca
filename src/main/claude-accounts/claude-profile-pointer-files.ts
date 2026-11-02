import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeFileAtomically } from '../codex-accounts/fs-utils'

const REPO_POINTER_PREFIX = 'selected-repo-'

/** Repo ids are not safe file names, so the pointer is keyed by a hash beside the global one. */
export function claudeRepoPointerPath(globalPointerPath: string, repoId: string): string {
  const hash = createHash('sha256').update(repoId).digest('hex').slice(0, 16)
  return join(dirname(globalPointerPath), `${REPO_POINTER_PREFIX}${hash}`)
}

export function writeClaudePointerFile(path: string, home: string): void {
  // Avoid rewriting the pointer on every launch.
  if (!existsSync(path) || readFileSync(path, 'utf8') !== home) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileAtomically(path, home, { mode: 0o600 })
  }
}

export function removeStaleClaudeRepoPointers(dir: string, keep: ReadonlySet<string>): void {
  if (!existsSync(dir)) {
    return
  }
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (name.startsWith(REPO_POINTER_PREFIX) && !keep.has(path)) {
      rmSync(path, { force: true })
    }
  }
}
