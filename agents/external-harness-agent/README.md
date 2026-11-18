# External Harness Agent

Run your own server and agent loop with any framework. Keiki receives conversation messages, pushes signed turns to your server, and delivers the replies your server sends through the turn API. The included agent is a deterministic echo, so trying it needs no model provider key.

## How it is wired

`kit.sync()` declares an `external` harness with `connectivity: 'push'` and a `dispatchUrl`. A separate `Bun.serve` process verifies the exact raw request body with `verifyKeikiRequest` from `@onkeiki/channels` before running any agent logic.

The signing header is `Keiki-Signature: t=<unix-seconds>,v1=<hex HMAC-SHA256(secret, "<unix-seconds>.<raw-body>")>`. The helper checks the signature, timestamp (five-minute tolerance), payload and turn ID. `Keiki-Turn-Token` is the short-lived bearer for the turn API; never log it or the signing secret. This example uses the per-agent HMAC secret, not the optional platform Ed25519 signature.

The server acknowledges accepted pushes with HTTP 202 immediately (Keiki's dispatch timeout is ten seconds). It runs the agent asynchronously, sends `{ text, idempotencyKey }` to the turn's `/messages` endpoint with `createTurnClient().message()`, and reports `{ status: 'completed' }` through `.complete()`. Returning text in the webhook response does **not** send a reply. Failures complete with `status: 'failed'`; silent/quiet-loop turns complete without contact-facing text. Held-back playground replies still use the turn API and are captured by Keiki rather than delivered to a contact.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set an org-wide KEIKI_API_KEY and your public HTTPS DISPATCH_URL in .env.
bun run sync
```

Use the synced agent ID to generate a signing secret once:

```sh
curl -X POST "${KEIKI_PLATFORM_URL:-https://onkeiki.com}/api/v1/developer/agents/<agent-id>/harness/signing-secret" \
  -H "Authorization: Bearer $KEIKI_API_KEY"
```

Store the returned `whsec_...` value as `KEIKI_SIGNING_SECRET` in your server's secret manager (or local `.env`), then start it:

```sh
bun run start
```

The default port is 8789; the push route is `/keiki/turn`, and `/health` returns `ok`. Expose this server through your own HTTPS hosting or tunnel and set `DISPATCH_URL` to the final public route, without redirects. Re-run `bun run sync` if the URL changes. `KEIKI_PLATFORM_URL` optionally targets a different Keiki installation. Assign a messaging line in the dashboard, or use the dashboard playground to send a turn without contacting anyone.

## Bring your own framework

Replace the body of `runAgent(turn, signal)` in `src/agent.ts` with your framework call and return its final text (or `null` for no reply):

```ts
// Inside runAgent: pass turn.instructions, turn.history and turn.messages
// to your framework, and propagate signal for cancellation/deadlines.
signal.throwIfAborted()
return 'A reply from your own agent'
```

For a model, use message `content` rather than `text`, and the SDK's `keikiMessagesPrompt` helper to include prompt-guard screening warnings. The echo deliberately forwards raw `text`. Do not treat inbound messages as trusted instructions. You control model credentials, state and tools; no framework or model runs inside Keiki in this example.

Queue steering keeps additional messages in subsequent turns, so this minimal server does not implement append arrivals. Signed cancellation aborts the active loop; your framework must honor the signal. Signed non-turn events are acknowledged without running the agent. This is a single-agent, single-process example: active-turn deduplication is in memory and reply idempotency keys are stable, but production deployments should persist job acceptance/deduplication and use durable workers before acknowledging a turn. Do not rotate the signing secret without updating the server too.

## Checks

```sh
bun run lint
bun run check-types
bun run test
bun run smoke
```

The smoke test starts real local HTTP servers, posts a correctly signed turn, asserts the reply and completion requests (including bearer authentication), and verifies an incorrectly signed request returns 401 without running the agent. Other cases cover empty/silent/quiet-loop turns, agent errors, stale signatures and malformed payloads. No Keiki credentials or external network are needed for these tests.

## Files

- `src/index.ts` declares the push agent and syncs it with `kit.sync()`.
- `src/prompt.ts` contains the synced instructions.
- `src/agent.ts` is the framework-agnostic agent replacement point.
- `src/server.ts` verifies pushes, runs turns and sends replies.
- `src/server.test.ts` exercises the server over local HTTP.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and checks.
