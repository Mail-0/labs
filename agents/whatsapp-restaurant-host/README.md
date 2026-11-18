# WhatsApp Restaurant Host

A warm, brief restaurant host that checks availability, takes and changes reservations, handles cancellations, and maintains a restaurant-wide walk-in waitlist. This is an independent example, not an official representative of any real restaurant.

## How it is wired

`src/index.ts` declares the agent with `@onkeiki/agents` and deploys it with `kit.sync()`. It follows Lovable's model, reasoning, history, memory, steering and guard settings, with voice-note transcription. It does not enable MCP connections, browser, sandbox, images, scraping or background loops. Native `send_card` is built in on WhatsApp; the prompt asks for concise text choices when it is unavailable.

Eight channel-neutral code tools use Effect Schema inputs:

- `check_availability(date, time?, party_size)` returns actual open slots, nearest the requested time first.
- `book_table(name, party_size, date, time, notes?)` re-checks shared capacity before writing.
- `list_my_reservations`, `change_reservation(reservation_id, name, party_size, date, time, notes?)`, and `cancel_reservation(reservation_id)` act only on the authenticated guest (`ctx.phone`). A change supplies all details; omitted notes become empty.
- `join_waitlist(name, party_size)`, `waitlist_status`, and `leave_waitlist` handle today's walk-ins, with one active entry per guest.

Reservations occupy fixed, non-overlapping sittings starting at opening, each `SLOT_MINUTES` long. Only sittings ending by closing are generated. For the defaults, those are 17:00, 18:30 and 20:00. Capacity is seats, not tables; the example does not optimize table combinations. Past slots cannot be booked. All dates/times are local to `RESTAURANT_TIMEZONE`. Hours are `daily HH:MM-HH:MM` or semicolon-separated `mon`–`sun` entries with a range or `closed`; unspecified days are closed. Duplicate days, overnight hours and invalid settings fail clearly at sync time.

The waitlist quote is deliberately rough: `ceil((seats ahead + party size) / capacity) × slot length`, with at least one sitting. It does not know live occupancy, table turnover, or reservations' impact on walk-in seating. Today's queue is isolated from prior dates. Joining is allowed before service and until the last sitting ends. Staff must manage seating outside this example; there is no automatic queue advancement, staff messaging or table-ready notification. A reservation does not automatically remove a waitlist entry.

## Shared storage and limitations

SDK 0.1.7's `contextEntityStore(ctx)` cloud bridge ignores a supplied tenant key and pins rows to the current guest; a constant such as `restaurant` does **not** create shared storage. Its `userState` is also per guest, and its generated bundle does not expose the platform's agent-wide `ctx.storage` bridge.

Instead, the org API key is synced as the developer secret `KEIKI_STORAGE_API_KEY`. Tools obtain it through `ctx.secrets`, never tool arguments or the prompt, and use the developer API's agent-wide storage. `KEIKI_PLATFORM_URL` (default `https://onkeiki.com`) and `RESTAURANT_HOST_CONFIG` are also synced as secrets so hosted code does not depend on local environment variables. Use HTTPS, except for localhost development.

The SDK's sync returns no agent ID to the caller and does not create a deployment external reference. Tools resolve the configured agent name exactly through `GET /api/v1/developer/agents` (the endpoint has no name filter), reject zero or multiple matches, and cache the ID per process. They then address only that agent's `host_reservations` or `host_waitlist` entity. Reads use JSON containment filters for the guest/date/status when applicable and page in batches of 100. Whole-entity reads are used only to preserve rows during a replacement write. Durable application IDs are stored inside each row because replacement regenerates platform row IDs.

Each write reads the entity, modifies it, and atomically replaces the whole entity with `PUT .../storage/:entity { rows }`, then re-reads the changed application ID and checks its saved contents. Cancellations and departures are retained as statuses so their writes can be verified. This example stops at 2,000 rows per entity (below the API's 20,000 limit); it never silently trims history. An operator must archive/maintain the book before that limit.

**Last writer wins:** replacement is atomic, but the read/modify/write sequence is not a transaction. Concurrent bookings can overwrite each other or exceed capacity; verification detects some immediate conflicts but cannot prevent later overwrites. Pagination is also not a snapshot. Do not use this design as a production reservation system without transactional capacity checks and queue operations. Ambiguous errors require checking current status before retrying; they are not proof that nothing was written.

Secrets are associated with the syncing key and may be shared by other agents using it. Use a dedicated example/test key, keep the configured agent name stable, and do not deploy multiple differently configured copies with that same key: their configuration secrets would collide. The org-wide key is privileged; never expose it in model-visible text, logs, tenant-controlled runtimes, or source control. This example has no key in its repository.

## Setup

From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY to an org-wide key in .env; optionally adjust the restaurant settings.
bun run sync
```

The default agent name is `labs-whatsapp-restaurant-host`. Only `KEIKI_API_KEY` is required. `.env.example` lists every setting; `.env` is ignored by the root `.gitignore`. No messaging number is purchased or connected by sync.

After sync, open the agent in the [Keiki dashboard](https://onkeiki.com). Go to **Channels → WhatsApp → Log in with Facebook → pick your business → verify your number** (about five minutes). See the [WhatsApp connection guide](https://onkeiki.com/docs/channels) for prerequisites and current details.

Use the dashboard's **Live Test** to try availability, confirm a booking, change it, cancel it, and join/leave the waitlist. Native cards may be unavailable in Live Test/preview; also test from the connected WhatsApp number for the real channel. Allergies are notes for staff, never a guarantee of kitchen safety. Larger parties are directed to call or speak with staff; no restaurant phone number is invented.

## Checks and files

```sh
bun run check-types
bun test
```

- `src/index.ts`: configuration and sync.
- `src/prompt.ts`: host voice, confirmation flow, cards and safety rules.
- `src/scheduling.ts`: pure hours, date/slot, capacity and quote logic.
- `src/tools.ts`: guest-authorized booking and queue tools.
- `src/storage.ts`: shared developer API client and secret-based runtime config.
- `src/*.test.ts`: scheduling, storage and tool behavior without live credentials.
- `package.json`, `tsconfig.json`, `bun.lock`, `.env.example`: self-contained Bun setup.
