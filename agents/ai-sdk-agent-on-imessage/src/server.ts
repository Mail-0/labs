import { createOpenAI } from '@ai-sdk/openai'
import { createKeikiHandler } from '@onkeiki/ai-sdk'
import { isStepCount, streamText } from 'ai'
import { systemPrompt } from './prompt.js'

if (!Bun.env.OPENROUTER_API_KEY) {
  throw new Error('Set OPENROUTER_API_KEY in .env before starting the server.')
}

const openrouter = createOpenAI({
  apiKey: Bun.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

const handler = createKeikiHandler({
  onTurn: async ({ turn, instructions, messages, tools, prepareStep, abortSignal }) => {
    console.info('Verified Keiki turn', turn.turnId)
    return streamText({
      model: openrouter.chat(Bun.env.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini'),
      instructions: [systemPrompt, instructions].filter(Boolean).join('\n\n'),
      messages,
      tools: await tools(),
      stopWhen: isStepCount(10),
      prepareStep,
      abortSignal,
    })
  },
})

const server = Bun.serve({
  port: Number(Bun.env.PORT ?? 3000),
  fetch(request) {
    if (new URL(request.url).pathname !== '/keiki/turn') {
      return new Response('Not found', { status: 404 })
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } })
    }
    return handler(request)
  },
})

console.info(`Keiki handler listening on ${server.url}keiki/turn`)
