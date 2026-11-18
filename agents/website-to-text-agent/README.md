# Website to Text

This agent reads a website and answers customers by iMessage or SMS using only that site's content. Replies are short; when the site lacks an answer it says "I don't know, a human will follow up".

## How it is wired

The agent enables the SDK's managed web scraping capability (`scrape: true`, available in `@onkeiki/agents` 0.1.7). Keiki provides `crawl_site`, `web_search`, and `scrape_page`; there is no local crawler, server, HTML parser, or external provider credential to manage.

On the first factual question in each conversation, the prompt tells the agent to crawl `SITE_URL` for readable Markdown (10 pages, depth 2). It answers from that content, reuses results in conversation history, and can search the configured domain and read up to 5 more pages for a question. The prompt restricts evidence and follow-up reads to the exact configured origin, not external sites or subdomains. These are model instructions, not a network-level allowlist; the managed tools themselves can access other public URLs. Do not use this example where a hard network boundary is required.

Empty results, unavailable pages, or unsupported questions trigger the fallback rather than a guess. The fallback does not create a ticket or notify anyone: arrange human monitoring of the inbox separately. Only use public sites you are authorized to crawl. Managed scraping usage is billed by Keiki. There is no persistent site index; content is fetched on demand, not during sync. JavaScript-only or login-protected sites may not yield usable content.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY and SITE_URL in .env.
bun run sync
```

Use a test org's API key for testing. After the sync completes, assign a line to the agent in the Keiki dashboard. Send a text asking a question answered by the site, then one not covered by it. For `https://example.com`, ask "What is this domain for?" (documentation examples) and "What are your opening hours?" (the fallback). Check tool traces for the crawl and domain-restricted research. No local process needs to remain running after sync.

Change `SITE_URL` and sync again to switch sites. Use a new conversation when testing a changed site so old results do not remain in history. `AGENT_NAME` and `KEIKI_PLATFORM_URL` are optional, as in the Lovable example.

## Checks

```sh
bun run check-types
bun run test
```

The unit tests exercise URL configuration and prompt source binding without credentials. A real scraping/retrieval smoke test requires a Keiki API key and a synced agent: send the two example questions above through the dashboard playground or an assigned line. Fetching example.com locally alone does not test Keiki's managed scraping or an agent reply.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/prompt.ts` validates the source URL and defines research and reply rules.
- `src/prompt.test.ts` tests source configuration.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and type-check.
