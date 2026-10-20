# Linear

This agent texts you, connects your own Linear account, finds and manages issues, and summarizes project or cycle progress using real workspace data.

## How it is wired

Like the [Lovable example](../lovable), this is a self-contained Bun package using `@onkeiki/agents` and `kit.sync()`. It declares a per-user MCP connection, conversation memory, sandbox and browser tools, loops, attachment processing, and guards. It does not install Lovable's app-building Images capability.

Each person authorizes their own Linear account. The agent uses Linear's official Streamable HTTP MCP endpoint, `https://mcp.linear.app/mcp`; it never uses the deployer's Linear account or a shared Linear API key.

Unlike Lovable's pre-registered OAuth client, [Linear supports OAuth dynamic client registration](https://linear.app/docs/mcp). The SDK uses that flow when the MCP connection omits `oauth`, so no `LINEAR_OAUTH_CLIENT_ID`, client secret, or hand-written scope setting is required in this example. Linear advertises `read` and `write` scopes; each person grants access in the provider's authorization flow. The connection's `capabilities` describe intended tasks for discovery, not OAuth permissions. Actual operations remain limited by the person's grant and workspace permissions.

The agent operates in the workspace exposed by that personal connection. Linear requires separate authentication contexts for separate workspaces; this example does not promise workspace switching through a single grant.

The prompt directs the agent to reuse healthy authorization and verified tool contracts, combine related scoped reads within one integration task, and verify writes from returned saved state when possible instead of making an extra read.

### Hosted feature settings

In SDK `0.1.4`, `kit.sync()` sends managed-feature on/off flags, not their nested options. The memory provider, sandbox persistence, steering values, and media actions in `src/index.ts` follow Lovable's declaration, but do not override hosted platform settings. Do not assume those specific values were applied by syncing.

Inspect the hosted configuration before relying on non-default behavior. The documented [`/config` API](https://onkeiki.com/docs/cloud-agents.md#developer-rest-api) exposes `steering_config`, which requires an org-wide key and affects every agent on that key. This example does not change those shared settings.

## Setup

Use a Keiki API key with `agents:write`, `tools:write`, `config:write`, and `alerts:write`, or an existing development key with `*`. [The sync endpoint requires all four write scopes](https://onkeiki.com/docs/cloud-agents.md#developer-rest-api), even with no custom tools or alerts; an `agents:chat`-only key cannot deploy this example.

From this directory:

```sh
bun install --frozen-lockfile
cp .env.example .env
# Set KEIKI_API_KEY in .env.
bun run check-types
bun run sync
```

`bun run sync` creates or updates a real agent in Keiki. After it completes, assign a line to the agent in the Keiki dashboard. No Linear credentials are needed at deployment time: each conversation user receives their own sign-in link, and the agent verifies their account before accessing Linear work.

Optionally set `AGENT_NAME` to change the deployment name. The assistant's conversational identity remains Linear.

For an iMessage contact card, optionally set both `CONTACT_CARD_PHONE` and `CONTACT_CARD_LOGO_URL`. Use the agent's assigned line in E.164 format and a public PNG logo URL. The contact-card instructions are included only when both values are set; contact sharing never delays account connection.

## Try it

After connecting your account, try requests such as:

- “What's assigned to me in the current cycle for the Engineering team?”
- “Create an issue in Engineering: the invite link expires before the email arrives. Include steps to reproduce from this screenshot.”
- “Move ENG-123 to In Progress and assign it to me.”
- “Add a comment to ENG-123: the fix is ready for review.”
- “Summarize the blocked work in the mobile launch project.”

The agent resolves actual teams, workflow states, members, and issue IDs through your connection, preserves unrelated fields, and returns provider-confirmed results with real links. Ordinary explicit single-issue requests authorize those changes; ambiguous, bulk, destructive, or access-related changes require confirmation. Questions and drafts do not authorize writes. Timed-out writes are reconciled before any retry.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/prompt.ts` contains the Linear workflow and optional contact-card instructions.
- `.env.example` lists required and optional environment variables.
- `package.json`, `bun.lock`, and `tsconfig.json` define the reproducible Bun package and type-check.
