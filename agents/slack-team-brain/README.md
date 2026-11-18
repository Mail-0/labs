# Slack Team Brain

Ask a question in Slack and get a short answer with the handbook section behind it.
The agent answers from two fictional Markdown documents, not the web or Slack history.
If the handbook doesn't cover the question, the agent says so.

## Setup

From this directory:

```sh
bun install --frozen-lockfile
cp .env.example .env
# Set KEIKI_API_KEY to an org-wide API key from your Keiki test organization.
bun run check-types
bun run sync
```

Open **Slack Team Brain** in the Keiki dashboard. Try the questions below in **Live
Test** before connecting Slack. On the agent's **Channels** page, follow the
[Slack setup](https://onkeiki.com/docs/slack-agents#setting-up-slack), install the
app in a test workspace, then invite it to a test channel. Mention the app there
or send it a DM; in a channel, it answers in a thread.

## Try it

| Ask | Expected answer |
| --- | --- |
| When should a new hire submit a laptop request? | By their first Thursday. Source: Onboarding handbook → Laptop orders. |
| How often should the incident lead post updates? | Every 30 minutes until resolution. Source: Incident response playbook → Status updates. |
| What's the travel reimbursement limit? | The handbook doesn't cover it. |

## Use your own docs

Edit the Markdown in `handbook/` and run `bun run sync` again. This example puts
the full handbook in the synced instructions; it is meant for a small, curated
set of docs. Use only information every person who can reach this agent may
read, including Slack Connect guests. Nothing here enforces per-document access
or syncs live from a document provider. Don't connect this agent to other channels
unless those audiences may read the same docs.
