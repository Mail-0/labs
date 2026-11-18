# iMessage Appointment Booking

Customers text a business to book, reschedule or cancel an appointment. The agent checks Cal.com availability, offers specific times, asks for confirmation and reports the result in the text thread.

## How it is wired

The agent declares an inline codemode capability for the **business owner's Cal.com account**. The owner supplies `CAL_API_KEY`, which is synced as a developer secret. Customers never authorize a calendar or provide an API key.

The capability grants HTTP access only to `api.cal.com`. Its prompt documents listing event types, checking slots, creating bookings, looking up a known attendee booking's current state, rescheduling and cancelling. The platform supplies `codemode_types` and `codemode_run`; the agent writes requests over the HTTP namespace. These are not six separately implemented tools. Keiki substitutes `{{CAL_API_KEY}}` on the host, without giving the secret to model-written code.

Cal.com controls calendar connections, services, availability, buffers and booking rules. `BUSINESS_HOURS` adds prompt guidance; configure matching hours in Cal.com for provider-enforced limits. This example supports standard one-on-one, non-recurring appointments, not seated events, recurring series or payment collection. Prompt instructions are not a deterministic authorization layer: the owner key can access the owner's bookings. For stricter customer identity verification or multi-business use, put an authenticated, customer-scoped booking service in front of Cal.com rather than relying on this example unchanged.

## Setup

1. In the business owner's [Cal.com account](https://app.cal.com), connect the business calendar, select calendars to check for conflicts and where bookings should be created, and set availability and timezone.
2. Create an event type for each service, with its duration, location, hours, buffers and booking fields. Start with standard one-on-one, non-recurring event types. If email verification is enabled, the agent asks permission to send a code, requests it through Cal.com, collects the received code and includes it in the create or reschedule request. It never bypasses verification; rescheduling still requires an earlier same-thread receipt.
3. Generate an owner API key under [Cal.com Settings → Developer → API keys](https://app.cal.com/settings/developer/api-keys). Check that the account/plan permits the API operations you need.
4. From this directory:

```sh
bun install
cp .env.example .env
# Set KEIKI_API_KEY and CAL_API_KEY in .env.
# Set BUSINESS_NAME, TIMEZONE and BUSINESS_HOURS for the business.
bun run check-types
bun run sync
```

Use an org-wide Keiki API key so the SDK can sync the developer secret. Sync publishes the inline capability privately under that developer and installs it on the agent; no public marketplace listing is needed. Keep the capability version in sync with manifest changes when upgrading it.

After syncing, assign an iMessage line to the agent in the [Keiki dashboard](https://onkeiki.com). No local server needs to stay running. Try a booking, then reschedule and cancel that same booking from the same thread. Live sync and bookings change real accounts; type-checking does not test a calendar connection.

Reschedule availability requests include the existing booking UID and its original duration in minutes. The agent preserves that length instead of falling back to a service's default duration.

## Configuration

| Variable | Purpose |
| --- | --- |
| `KEIKI_API_KEY` | Required org-wide Keiki API key. |
| `CAL_API_KEY` | Required business owner's Cal.com API key. |
| `AGENT_NAME` | Agent name; defaults to `Appointment Booking`. |
| `BUSINESS_NAME` | Customer-facing business name; defaults to `Your Business`. |
| `TIMEZONE` | IANA timezone; defaults to `America/New_York`. |
| `BUSINESS_HOURS` | Human-readable hours; defaults to `Monday-Friday, 9am-5pm`. Match Cal.com's availability. |
| `KEIKI_PLATFORM_URL` | Optional SDK platform URL override; defaults to `https://onkeiki.com`. |

The agent collects name, service, preferred time, email and phone. It may reschedule or cancel only a booking whose receipt was established earlier in the same thread. Customer-supplied email addresses, UIDs or confirmation details are not proof of ownership; without that earlier receipt, it refers the customer to the business and modifies nothing. Do not deploy with sensitive services without reviewing your customer-verification requirements.

## Cal.com API versions

Requests use `Authorization: Bearer {{CAL_API_KEY}}` and endpoint-specific `cal-api-version` headers:

| Operation | Endpoint | Version |
| --- | --- | --- |
| Owner event types | `GET /v2/event-types` | `2026-06-12` |
| Slots | `GET /v2/slots` | `2024-09-04` |
| Create booking | `POST /v2/bookings` | `2026-02-25` |
| Attendee bookings | `GET /v2/bookings` | `2026-05-01` |
| Reschedule | `POST /v2/bookings/{bookingUid}/reschedule` | `2026-02-25` |
| Cancel | `POST /v2/bookings/{bookingUid}/cancel` | `2026-02-25` |
| Send verification code | `POST /v2/bookings/verification/email/send-code` | No version header documented; omitted |

Contracts are documented in [Cal.com's v2 reference](https://cal.com/docs/api-reference/v2) and its [OpenAPI document](https://cal.com/docs/api-reference/v2/openapi.json). Booking lookup always sends the earlier thread receipt's attendee email and booking UID to Cal.com. It checks upcoming first, then unconfirmed if absent, and cancelled only when reconciling an uncertain cancellation; it stops at the first match. It does not fetch everyone's bookings and filter locally. Empty availability, conflicts, pending requests and provider failures are handled in the agent's instructions, not by a local booking server.

## Files

- `src/index.ts` declares the agent, inline capability and developer secret, then calls `kit.sync()`.
- `src/prompt.ts` contains business booking instructions and the Cal.com API contract.
- `.env.example` lists required and optional environment variables.
- `package.json`, `tsconfig.json` and `bun.lock` define the Bun package and type-check.
