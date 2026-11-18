import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { agentConfig } from '../src/config.js'

const config = agentConfig(Bun.env)
const service = config.agent.capabilities[0].mcp
const client = new Client({ name: 'labs-imessage-smoke', version: '1.0.0' })

try {
  await client.connect(new StreamableHTTPClientTransport(new URL(service.url), {
    requestInit: {
      headers: Bun.env.MCP_AUTH_VALUE
        ? { [Bun.env.MCP_AUTH_HEADER ?? 'Authorization']: Bun.env.MCP_AUTH_VALUE }
        : {},
      signal: AbortSignal.timeout(30_000),
    },
  }))
  const { tools } = await client.listTools()
  if (!tools.length) throw new Error('The MCP server returned no tools.')
  console.log(`MCP connected: ${tools.length} tools: ${tools.map(tool => tool.name).join(', ')}`)
  if (!Bun.env.MCP_SERVER_URL) {
    const result = await client.callTool({
      name: 'microsoft_docs_search', arguments: { query: 'What is Azure Functions?' },
    })
    if (result.isError) throw new Error('Microsoft Learn search returned an error.')
    if (!JSON.stringify(result.content).includes('Azure Functions')) {
      throw new Error('Search did not return the expected documentation.')
    }
    console.log('MCP tool call passed: Microsoft Learn returned Azure Functions documentation.')
  }
  console.log('This probes MCP only; verify the hosted agent reply in Keiki Live Test after sync.')
} finally {
  await client.close()
}
