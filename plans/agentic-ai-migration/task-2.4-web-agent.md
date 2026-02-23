# Task 2.4: Create Web Agent

## Goal
Create the web sub-agent for external content scraping

## Context
Uses AI SDK's ToolLoopAgent with web category tools. Uses the same model as orchestrator (user's selection).

## Implementation

**File**: `packages/ai/agents/web.ts`

```typescript
import { ToolLoopAgent, stepCountIs, type InferAgentUIMessage } from "ai";
import { model, type ModelId } from "@repo/ai/config/vercel";
import { webAgentPrompt } from "@repo/ai/prompt/agents/web";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { AgentConfigSchema } from "./schema";
import { getToolsByCategory } from "./registry";

/**
 * Web agent configuration
 */
export const webAgentConfig = AgentConfigSchema.parse({
  id: "web",
  name: "Web Agent",
  description: "Specialized agent for scraping external web content",
  instructions: webAgentPrompt(),
  maxSteps: 5,
});

/**
 * Create web agent instance
 * 
 * @param writer - UIMessageStreamWriter for UI updates
 * @param selectedModel - Model ID selected by user (same as orchestrator)
 * @returns Configured ToolLoopAgent
 */
export function createWebAgent(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId
) {
  return new ToolLoopAgent({
    // Uses the same model as orchestrator (user's selection)
    model: model.languageModel(selectedModel),
    instructions: webAgentConfig.instructions,
    tools: getToolsByCategory("web", writer),
    stopWhen: stepCountIs(webAgentConfig.maxSteps),
  });
}

/**
 * Type for web agent messages
 * Used in UI for type-safe message rendering
 */
export type WebAgentMessage = InferAgentUIMessage<
  ReturnType<typeof createWebAgent>
>;

/**
 * Scrape URL convenience function
 * 
 * @param writer - UIMessageStreamWriter
 * @param selectedModel - Model ID selected by user
 * @param url - External URL to scrape
 * @param options - Optional context and abort signal
 */
export async function scrapeUrl(
  writer: UIMessageStreamWriter<MyUIMessage>,
  selectedModel: ModelId,
  url: string,
  options?: { context?: string; abortSignal?: AbortSignal }
) {
  const agent = createWebAgent(writer, selectedModel);
  
  const prompt = options?.context
    ? `Scrape and analyze: ${url}\n\nContext: ${options.context}`
    : `Scrape and analyze: ${url}`;
  
  const result = await agent.generate({
    prompt,
    abortSignal: options?.abortSignal,
  });
  
  return {
    output: result.text,
    usage: result.usage,
    toolCalls: result.toolCalls,
  };
}

/**
 * Check if a URL is external (not Nakafa)
 */
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    const blockedDomains = [
      "nakafa.com",
      "www.nakafa.com",
      "localhost",
      "127.0.0.1",
    ];
    
    for (const domain of blockedDomains) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return false;
      }
    }
    
    // Block private IPs
    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
    ];
    
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate URL format and safety
 */
export function validateUrl(url: string): {
  valid: boolean;
  external: boolean;
  reason?: string;
} {
  try {
    const urlObj = new URL(url);
    
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return {
        valid: false,
        external: false,
        reason: "URL must use http or https",
      };
    }
    
    const external = isExternalUrl(url);
    
    if (!external) {
      return {
        valid: false,
        external: false,
        reason: "Cannot scrape Nakafa URLs. Use content agent.",
      };
    }
    
    return { valid: true, external: true };
  } catch {
    return {
      valid: false,
      external: false,
      reason: "Invalid URL format",
    };
  }
}

/**
 * Extract URL from query string
 */
export function extractUrlFromQuery(query: string): string | null {
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const matches = query.match(urlPattern);
  return matches ? matches[0] : null;
}
```

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
