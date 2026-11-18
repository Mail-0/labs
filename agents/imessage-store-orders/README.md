# iMessage Store Orders

A Shopify store's sales clerk on iMessage: shoppers text what they want, the agent searches the live catalog, confirms items, variants and quantities, builds a cart, and sends Shopify's checkout link. Payment happens through Shopify checkout, not by sharing card details in chat. A cart is a proposed order, not proof of payment.

## How it is wired

The agent declares a full `CapabilityManifest` in `agent.capabilities`, with `runtime: 'mcp'` and `mcp: { url: 'https://<SHOPIFY_STORE_DOMAIN>/api/mcp', auth: 'none' }`. It declares no capability tools: Shopify supplies them. `kit.sync()` privately publishes and installs the manifest. The slug combines a normalized domain prefix with a hash of the full domain so stores have distinct capability identities.

The public Storefront MCP server needs no Shopify credentials. Its available tools determine whether catalog search, product details, cart updates and policy lookup are available. Conversation memory, steering, guards, prompt guard and media handling are enabled; no browser, sandbox or per-user account connection is declared by this example.

The agent uses the same cart id for edits and sends the returned `checkout_url` unchanged. Storefront MCP cannot read existing orders; shoppers are directed to the order status link in their confirmation email or the store's contact channel.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY and SHOPIFY_STORE_DOMAIN in .env.
bun run check-types
bun run sync
```

Use an org-wide Keiki API key to publish the private capability. After syncing, assign an iMessage line to the agent in the Keiki dashboard.

`SHOPIFY_STORE_DOMAIN` is a hostname only, such as `allbirds.com`, without a protocol, port or path. The example environment uses Allbirds as a public test store, not as an affiliation. Check that your store exposes the catalog and cart tools before trying the shopping flow:

```sh
curl -X POST https://allbirds.com/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

At the time this example was checked, Allbirds returned only `search_shop_policies_and_faqs`; that response verifies the endpoint but does not enable catalog search or checkout. Use a store exposing the catalog and cart tools for the full flow. The agent must report unavailable functionality rather than invent results.

Optional environment variables:

- `AGENT_NAME`: Keiki agent name, default `Store Orders`. Use a distinct name for each store's agent.
- `STORE_NAME`: shopper-facing store name, default the store domain.
- `KEIKI_PLATFORM_URL`: platform base URL, default `https://onkeiki.com`. The SDK reads this environment variable directly.

The capability version is pinned to `1.0.0`. When changing an already-published manifest for the same store, increment its version before syncing; published versions are immutable.

## Files

- `src/index.ts` validates configuration, declares the Storefront capability and agent, and runs `kit.sync()`.
- `src/prompt.ts` contains the text-message sales clerk prompt.
- `.env.example` lists required and optional environment variables.
- `package.json`, `bun.lock` and `tsconfig.json` define the self-contained Bun package and type-check.
