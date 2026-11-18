# iMessage Store Orders

A Shopify store's sales clerk on iMessage: shoppers text what they want, the agent searches the live catalog, confirms items, variants and quantities, builds a cart, and sends Shopify's checkout link. Payment happens through Shopify checkout, not by sharing card details in chat. A cart is a proposed order, not proof of payment.

## How it is wired

The agent declares a full `CapabilityManifest` in `agent.capabilities`, with `runtime: 'mcp'` and `mcp: { url: 'https://<SHOPIFY_STORE_DOMAIN>/api/ucp/mcp', auth: 'none' }`. This UCP endpoint is advertised at `https://<SHOPIFY_STORE_DOMAIN>/.well-known/ucp`. It declares no capability tools: Shopify supplies them. `kit.sync()` privately publishes and installs the manifest. The slug combines a normalized domain prefix with a hash of the full domain so stores have distinct capability identities.

The public UCP MCP server needs no Shopify credentials. Calls require `meta: { "ucp-agent": { "profile": "https://<SHOPIFY_STORE_DOMAIN>/.well-known/ucp" } }` plus the tool-specific payload. This example uses the store's public profile for capability negotiation, which Allbirds accepts; it is not an authenticated agent identity or a separately hosted Keiki agent profile. Verify profile compatibility for another store. Conversation memory, steering, guards, prompt guard and media handling are enabled; no browser, sandbox or per-user account connection is declared by this example.

The agent uses `search_catalog`/`get_product` to verify live prices and stock, formats integer minor-unit prices in the returned currency, and uses `create_cart`/`update_cart` for the proposed order. It reuses the cart id and calls `create_checkout` with `{ cart_id, line_items: [] }`, then sends the returned buyer-facing `continue_url` unchanged. Missing contact/address details can be completed on that page. It never calls `complete_checkout` or collects payment details. Policies use `ask_business`. It does not call `get_order`, which requires authenticated requests; existing-order questions go to the confirmation email's order status link or store support, with contact details verified through `ask_business`.

## Setup

After a cart edit, the agent updates the existing checkout or creates a new one from the updated cart. It checks the returned checkout's variant ids and quantities against the confirmed cart before sharing its link; a mismatch is reported without sending the link.

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
curl -X POST https://allbirds.com/api/ucp/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Allbirds exposes catalog, cart, checkout and business-question tools used by this example at this endpoint; its authenticated order lookup is not used. Tool schemas specify required metadata and named payloads. For example, a catalog request uses `{"meta":{"ucp-agent":{"profile":"https://allbirds.com/.well-known/ucp"}},"catalog":{"query":"running shoes","filters":{"available":true},"pagination":{"limit":3}}}` as the `search_catalog` arguments. Creating a checkout is not a purchase: the shopper must open `continue_url` and pay on Shopify's page.

Optional environment variables:

- `AGENT_NAME`: Keiki agent name, default `Store Orders`. Use a distinct name for each store's agent.
- `STORE_NAME`: shopper-facing store name, default the store domain.
- `KEIKI_PLATFORM_URL`: platform base URL, default `https://onkeiki.com`. The SDK reads this environment variable directly.

The capability version is pinned to `1.1.0`. When changing an already-published manifest for the same store, increment its version before syncing; published versions are immutable.

## Files

- `src/index.ts` validates configuration, declares the Storefront capability and agent, and runs `kit.sync()`.
- `src/prompt.ts` contains the text-message sales clerk prompt.
- `.env.example` lists required and optional environment variables.
- `package.json`, `bun.lock` and `tsconfig.json` define the self-contained Bun package and type-check.
