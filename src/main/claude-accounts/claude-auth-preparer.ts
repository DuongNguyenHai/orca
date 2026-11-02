import type { PrepareClaudeAuth } from '../ipc/pty/host-env/types'
import type { ClaudeRuntimeAuthService } from './runtime-auth-service'

/** The one PTY wiring for Claude auth, so no call site can drop the repo scope. */
export function claudeAuthPreparer(
  getService: () => Pick<ClaudeRuntimeAuthService, 'prepareForClaudeLaunch'>
): PrepareClaudeAuth {
  return (target, scope) => getService().prepareForClaudeLaunch(target, scope)
}
