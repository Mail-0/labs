import type { KeikiTurn } from '@onkeiki/channels'

export async function runAgent(turn: KeikiTurn, signal: AbortSignal): Promise<string | null> {
  signal.throwIfAborted()
  if (turn.silent || turn.quietLoop) return null
  const text = turn.messages.filter(message => !message.silent).map(message => message.text).join('\n')
  return text ? `Your harness received: ${text}` : null
}
