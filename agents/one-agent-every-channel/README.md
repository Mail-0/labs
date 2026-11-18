# One Agent Every Channel

One assistant on iMessage, WhatsApp, Slack, Telegram and email. It remembers useful context and adapts its replies to each channel. The goal is one memory per person; the current platform scopes memory to conversations, so linked identities alone do not yet provide cross-channel recall.

## How it is wired

`kit.sync()` syncs the agent and enables memory. Keiki recalls relevant memories automatically and learns useful facts after replies. Attach channels to the same agent in its **Channels** tab. No local server or storage adapter is needed. See [Identity and permissions](https://onkeiki.com/docs/identity) for verifying who is speaking.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY in .env; optionally set AGENT_NAME.
bun run sync
```

Open the agent in [Keiki](https://onkeiki.com) and select **Channels**. Add whichever channels you need:

1. **iMessage:** assign a line to the agent in the dashboard.
2. **WhatsApp:** connect your Business number with its access token, phone number ID, app secret and verify token.
3. **Slack:** create and install an app using Keiki's manifest, connect its bot token and signing secret, and invite it to your channels.
4. **Telegram:** create a bot with BotFather and connect its bot token.
5. **Email (AgentMail):** choose a region and create an inbox or connect an existing inbox by ID.

Follow the dashboard's webhook and domain-verification instructions. Keep channel credentials in Keiki. See [Channels](https://onkeiki.com/docs/channels) for provider setup.

Test memory through a real channel: Live Test and MCP `talk_to_agent` conversations do not read or write persistent memory. Learning runs in the background, so newly shared facts may not be available immediately.

## Files

- `src/index.ts` declares the agent, enables memory and calls `kit.sync()`.
- `src/prompt.ts` defines the assistant's tone, memory use and channel formatting.
- `.env.example` lists the API key and optional settings.
- `package.json`, `bun.lock` and `tsconfig.json` define the Bun package and type-check.

```sh
bun run check-types
```
