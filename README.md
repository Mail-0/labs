# Labs

Labs is where Mail-0 publishes example agents built with Keiki (https://onkeiki.com) and the `@onkeiki/agents` SDK.

| Agent | Example |
| --- | --- |
| Lovable | [agents/lovable](agents/lovable) |
| iMessage Store Orders (Shopify UCP checkout) | [agents/imessage-store-orders](agents/imessage-store-orders) |
| MCP server on iMessage | [agents/mcp-server-on-imessage](agents/mcp-server-on-imessage) |
| Email inbox agent | [agents/email-inbox-agent](agents/email-inbox-agent) |
| iMessage Appointment Booking | [agents/imessage-appointment-booking](agents/imessage-appointment-booking) |
| Pocket | [agents/text-first-consumer-app](agents/text-first-consumer-app) |
| One Agent Every Channel | [agents/one-agent-every-channel](agents/one-agent-every-channel) |
| iMessage Customer Support | [agents/imessage-customer-support](agents/imessage-customer-support) |
| WhatsApp Restaurant Host | [agents/whatsapp-restaurant-host](agents/whatsapp-restaurant-host) |

Each example is a self-contained Bun package that declares its agent in code and deploys it with `kit.sync()`.
