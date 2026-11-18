# AI SDK agent on iMessage

Get your agent live with customers, today. Bring your own Vercel AI SDK 7 agent to iMessage with Keiki: your server runs `streamText`, and Keiki handles the iMessage line, delivery, conversation history, MCP tools and mid-turn arrivals.

## How it is wired

`bun run sync` declares an external-harness agent pointing at your server's `POST /keiki/turn` endpoint. This is not a Keiki-hosted model loop: your persistent Bun server owns the AI SDK loop and uses your own OpenRouter key.

`createKeikiHandler` verifies Keiki's signed dispatch, acknowledges it with 202, and runs the turn asynchronously. The handler supplies instructions and history, loads Keiki tools with `await tools()`, and uses `prepareStep` and `abortSignal` for arrivals and cancellation. Replies and completion flow back to Keiki for channel delivery and tracing. Configure MCP connections in Keiki to make their tools available to this loop.

This example requires the agent's external harness signing secret so the handler accepts only that agent's signed dispatches. Provider credentials stay in your server and are not synced to Keiki. Keep the server running after it acknowledges a dispatch; a request-scoped serverless function needs a lifecycle hook such as `waitUntil` instead.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set an org-wide KEIKI_API_KEY and your OPENROUTER_API_KEY in .env.
```

Expose port 3000 over public HTTPS, for example (leave this running):

```sh
cloudflared tunnel --url http://localhost:3000
```

Set `HARNESS_URL` in `.env` to the full tunnel URL plus `/keiki/turn`, then:

```sh
bun run sync
```

Generate the agent's external harness signing secret in the Keiki dashboard, or call `POST /api/v1/developer/agents/:agentId/harness/signing-secret` with your API key. Store the returned `signingSecret` as `KEIKI_SIGNING_SECRET` in `.env`; it is shown only once. The server refuses to start without it, and the handler reads it automatically. Optionally set `KEIKI_AGENT_ID` to the ID printed by sync as an additional guard against other agents before tools or model calls.

```sh
# Required in .env: KEIKI_SIGNING_SECRET; optional: KEIKI_AGENT_ID.
bun run dev
```

Assign an iMessage line to the agent in the [Keiki dashboard](https://onkeiki.com), then text that line. You can also use the dashboard's Live Test to exercise the loop without a line. A verified dispatch prints `Verified Keiki turn` in your server terminal; inspect the turn trace in Keiki for delivery or model errors.

Keep the same `AGENT_NAME` when syncing updates. If the tunnel URL changes, update `HARNESS_URL` and sync again. For deployment, run `bun run start` on a persistent server behind HTTPS. `OPENROUTER_MODEL` selects the model; the default is `openai/gpt-4.1-mini`.

For a local/self-hosted Keiki platform, set `KEIKI_PLATFORM_URL` for sync and generate `KEIKI_SIGNING_SECRET` on that platform using the same endpoint above. Local HTTP dispatch also requires the platform's explicit insecure/private URL development flags. Never use those flags in production.

## Files

- `src/index.ts` declares the external agent and syncs it with `kit.sync()`.
- `src/server.ts` serves the signed turn handler and your AI SDK model loop.
- `src/prompt.ts` contains the short, plain-text iMessage prompt.
- `.env.example` lists required and optional environment variables.
- `package.json`, `bun.lock` and `tsconfig.json` define the self-contained Bun package and type-check.
