# Email inbox agent

An assistant with its own email inbox. It answers inbound emails in the same thread, remembers each correspondent and schedules one check-in when it is waiting for a reply.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY to an org-wide API key from the Keiki dashboard.
bun run check-types
bun run sync
```

After syncing, open the agent in the Keiki dashboard → **Channels → Email** and create its inbox. Choose the US or EU region. You can optionally use your own domain by adding the DNS records shown; AgentMail verifies them after DNS propagates. Email the inbox address to start a conversation.

`kit.sync()` deploys the agent configuration; it does not create an inbox or attach channels. Inbox identities are provisioned platform-side through the dashboard. Do not make a second deployment with the same name to attach email.

## Configuration

Only `KEIKI_API_KEY` is required. Optional environment variables:

- `AGENT_NAME`: deployment name, default `Inbox`. Reuse it when syncing updates.
- `KEIKI_PLATFORM_URL`: platform URL; omit for the hosted platform.
- `BUSINESS_CONTEXT`: business facts and follow-up timing appended to the prompt. For example: `We repair bicycles. Ask for the bicycle model before quoting. Follow up after 2 business days.` Without a specified delay, the prompt uses 2 days.

No MCP connections or developer secrets are needed. The platform supplies email delivery, Supermemory, scheduling and attachment processing. The configuration enables memory, one-time loops, document extraction, image descriptions, steering and prompt guards. An unreadable attachment is identified rather than guessed at.

Follow-ups use the platform's `create_loop`, `list_loops`, `update_loop` and `delete_loop` tools. The prompt asks for one pending loop per thread, cancellation when a reply arrives, and no further reminders after the scheduled check-in. These are model instructions, not a hard delivery quota; test the behavior for your workflow before using it unattended. A scheduled check-in must re-check the thread and stay silent if it is no longer needed.

## Files

- `src/index.ts` declares the agent and runs `kit.sync()`.
- `src/prompt.ts` contains the email instructions and optional business context.
- `.env.example` lists required and optional environment variables.
- `package.json`, `bun.lock` and `tsconfig.json` define the self-contained Bun package.
