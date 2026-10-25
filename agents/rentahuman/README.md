# RentAHuman

This agent lets you hire real people for real-world tasks by text. It answers with live RentAHuman supply before you sign in, connects your own RentAHuman account when you want to post, previews every bounty with the 18% service fee, posts only after you say yes, and relays applicants, messages and proof back into the chat.

## How it is wired

The agent declares a per-user MCP connection to RentAHuman's remote server (`https://rentahuman.ai/api/mcp`). Each person signs in to their own account, or joins from the same page; the deployer's account is never used. RentAHuman supports dynamic client registration, so no OAuth app or developer secret is needed.

Before sign-in, the agent uses RentAHuman's public REST endpoints (`GET /api/humans`, `GET /api/bounties/location-minimum`) from its sandbox to show who is nearby. It also enables conversation memory, a persistent sandbox and loops; a loop on the person's own connection checks a posted bounty for new applications, messages and submissions.

The remote connection has no payment-release or wallet tools. The agent sends the bounty link so the person releases payment, or completes a deposit checkout, on RentAHuman.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY in .env.
bun run sync
```

After the sync completes, connect a Telegram bot to the agent in the Keiki dashboard: create a bot with @BotFather and paste its token under Connect Telegram bot. You can also assign an SMS or iMessage line.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/prompt.ts` contains the prompt.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and type-check.
