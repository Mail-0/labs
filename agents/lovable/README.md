# Lovable

This agent texts you, connects your own Lovable account, builds and refines apps, publishes them when requested, and sends real screenshots and links.

## How it is wired

The agent declares a per-user MCP connection to Lovable. Each person signs in to their own account; the deployer's Lovable account is never used. It also enables conversation memory, a persistent sandbox, browser tools, loops, and the Images capability (`images@1.1.0`).

Lovable grants publish scopes only to approved OAuth clients, so this example uses a pre-registered client. Register one with Lovable using this redirect URI:

`https://onkeiki.com/api/webapp/user-oauth/callback`

The client ID and secret are synced as developer secrets. The agent syncs them only when both environment variables are set.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY and the Lovable OAuth client credentials in .env.
bun run sync
```

Use an org-wide API key so the SDK can sync developer secrets. After the sync completes, assign a line to the agent in the Keiki dashboard.

For an iMessage contact card, optionally set both `CONTACT_CARD_PHONE` and `CONTACT_CARD_LOGO_URL` in `.env`. The prompt adds its contact-card instructions only when both are set.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/prompt.ts` contains the prompt and optional contact-card section.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and type-check.
