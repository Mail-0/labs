# MCP server on iMessage

Put your MCP server or API on an iMessage line and get your agent live with customers. People text the line to ask questions and use your service's tools.

## How it is wired

The agent installs a private MCP capability through `kit.sync()`. Keiki connects to the remote server and exposes its tools to the hosted agent; no local message server is needed. The default is the public Microsoft Learn MCP server over streamable HTTP, so you can start by texting “What is Azure Functions?”

Set `MCP_SERVER_URL` to your own HTTPS MCP endpoint. For an authenticated service, set `MCP_AUTH_VALUE` to the complete header value (for example, `Bearer your-token`); `MCP_AUTH_HEADER` defaults to `Authorization`. The value is synced as a developer secret and referenced by a placeholder, never embedded in the prompt or manifest. This connection uses the deployer's shared service account for all customers. Only expose tools and data those customers are allowed to access. For individual customer accounts, use Keiki's per-user MCP connections instead.

For an API without an MCP endpoint, replace the MCP capability with an OpenAPI or HTTP capability following the [Keiki publishing guide](https://onkeiki.com/docs/publishing). This example connects MCP servers directly; it does not convert an arbitrary REST URL into MCP.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY and any MCP service credentials in .env.
bun run sync
```

Use an org-wide API key so the SDK can sync developer secrets. After the sync completes, assign a line to the agent in the Keiki dashboard. No texts are sent by sync. The capability uses the fixed slug `imessage-mcp-service`; use a different slug for independent services in the same org.

To check the example locally:

```sh
bun run check-types
bun run test
bun run smoke
```

The smoke script connects to the real MCP endpoint and lists its tools. With the default server it also performs a documentation search. It does not send texts or exercise the hosted agent. In the dashboard's Live Test, send “What is Azure Functions?” and check that the agent uses the documentation tools and returns an accurate answer with a documentation link. For your own service, use a read-only sample request and verify the tool result and reply in the trace. A failed or unavailable service must not produce a fabricated success.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/config.ts` configures the native MCP capability and optional secret.
- `src/prompt.ts` contains the prompt.
- `src/config.test.ts` checks defaults, authentication and invalid configuration.
- `scripts/smoke.ts` checks the live MCP connection without sending messages.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and type-check.
