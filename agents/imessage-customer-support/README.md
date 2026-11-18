# iMessage Customer Support

Run a customer support agent on Keiki that answers order questions over iMessage, opens and looks up support tickets, and hands conversations to a teammate when a person is needed.

## How it is wired

The order tool reads fictional orders from memory. The ticket tools use Keiki's per-contact state so a ticket survives across messages and another contact cannot look it up. No store or help desk account is required. For real orders, replace the demo data with a store backend that verifies each contact's access before returning order details.

Keiki's built-in `escalate` tool opens a case in the dashboard's **Handoffs** queue. A teammate can claim the case and reply in the same conversation. The agent goes silent once the teammate claims it and stays silent until the case is resolved or handed back.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY in .env.
bun run sync
```

Use a Keiki org-wide API key. After syncing, open the agent in the [Keiki dashboard](https://onkeiki.com) and connect an iMessage line under **Channels**. Use an org that supports running tools; a restricted onboarding test runs without tools.

## Try it

Use the saved agent's **Live Test** or text the connected iMessage line:

- “Where is order ORD-1001?” It should report that the package has shipped. `ORD-1002` is processing and `ORD-1003` was delivered.
- “I'd like to open a ticket for a missing item.” Confirm the summary, then use the returned ticket ID to ask for its status in the same conversation. It should be open.
- On the iMessage line, ask to speak to a human and check that the case appears under **Handoffs**. Claim it and send a follow-up message from the customer; the agent should no longer reply. Live Test does not run the escalation tool.

Local checks: `bun run check-types`, `bun run lint`, and `bun run test`.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/prompt.ts` defines how the agent handles support requests.
- `src/tools.ts` and `src/tools.test.ts` define and test the order and ticket tools.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and type-check.
