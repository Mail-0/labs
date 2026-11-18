# Pocket

A text-first consumer app: a personal life-admin companion whose whole interface is texting on iMessage. No app to download: text a reminder, send a flyer or voice note, or opt into a morning brief.

## How it is wired

The agent enables conversation memory, loops, web scraping and media processing for photos, voice notes and PDFs. Hosted platform tools handle these features; no custom tools or customer credentials are needed. Pocket learns a person's name, timezone and priorities over text, asks before starting recurring messages, and cancels their loops on STOP or opt-out.

The optional `morning-brief` loop preset is fixed at 8am UTC and requires explicit consent. Other schedules use custom loops in the person's confirmed timezone. Attachment processing and memory require the corresponding providers to be configured on the platform.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY in .env.
bun run sync
```

Use an org-wide API key. After sync completes, assign an iMessage line in the Keiki dashboard. Test onboarding, a reminder and STOP in Live Test before connecting customers. Try “hey”, share your timezone, then “remind me to call mom tomorrow at 6pm”. Check that a real reminder appears, then send “STOP” and verify it is canceled.

For an iMessage contact card, optionally set both `CONTACT_CARD_PHONE` and `CONTACT_CARD_LOGO_URL` in `.env`. The prompt adds its contact-card instructions only when both are set. A persistent sandbox is enabled to create the vCard.

For a local platform, set `KEIKI_PLATFORM_URL=http://localhost:8080`. Run `bun run check-types` to type-check the example.

## Files

- `src/index.ts` declares the agent and syncs it with `kit.sync()`.
- `src/prompt.ts` contains the onboarding, reminders, media and opt-out instructions.
- `.env.example` lists required and optional environment variables.
- `package.json` and `tsconfig.json` define the Bun package and type-check.
