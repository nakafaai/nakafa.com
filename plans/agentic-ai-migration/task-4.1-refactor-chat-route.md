# Task 4.1: Refactor Chat Route

## Goal
Replace `streamText` with orchestrator agent in chat API route

## Context
Updates `apps/www/app/api/chat/route.ts` to use new agentic architecture with dynamic model selection

## Implementation

**File**: `apps/www/app/api/chat/route.ts`

### Step 1: Update Imports

Replace:
```typescript
import { tools } from "@repo/ai/tools";
import { 
  streamText, 
  stepCountIs,
  // ... other streamText related imports
} from "ai";
```

With:
```typescript
import { createOrchestratorAgent } from "@repo/ai/agents/orchestrator";
```

### Step 2: Update Execute Function

Replace the `execute` function (around line 254):

```typescript
execute: async ({ writer }) => {
  // Create orchestrator with user's selected model (dynamic)
  // and full context
  const orchestrator = createOrchestratorAgent({
    writer,
    selectedModel, // User's selected model from request
    context: {
      url,
      currentPage: { locale, slug, verified },
      currentDate,
      userLocation: {
        city: userLocation.city,
        country: userLocation.country,
      },
      userRole,
    }
  });
  
  // Run orchestrator
  const result = await orchestrator.stream({
    messages: compressedMessages,
  });
  
  // Stream to UI
  writer.merge(
    result.toUIMessageStream({
      sendReasoning: true,
      sendStart: false,
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return {
            model: selectedModel, // Track which model was used
            token: {
              input: part.totalUsage.inputTokens,
              output: part.totalUsage.outputTokens,
              total: part.totalUsage.totalTokens,
            },
          };
        }
      },
      onError: (error) => {
        if (error instanceof Error) {
          logError(sessionLogger, error, {
            errorLocation: "orchestrator-stream",
            errorType: error.name,
          });
          
          if (error.message.includes("Rate limit")) {
            return t("rate-limit-message");
          }
          return error.message;
        }
        return t("error-message");
      },
    })
  );
  
  await result.consumeStream();
  
  // Get messages for suggestions
  const messagesFromResponse = (await result.response).messages;
  
  // Generate suggestions (unchanged)
  const suggestionsStream = streamText({
    model: model.languageModel(defaultModel),
    system: nakafaSuggestions(),
    messages: [...finalMessages, ...messagesFromResponse],
    output: Output.object({
      schema: z.object({
        suggestions: z.array(z.string()),
      }),
    }),
    providerOptions: {
      gateway: { order },
      google: {
        thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
      },
    },
  });
  
  const dataPartId = crypto.randomUUID();
  
  for await (const chunk of suggestionsStream.partialOutputStream) {
    writer.write({
      id: dataPartId,
      type: "data-suggestions",
      data: {
        data: chunk.suggestions?.filter((s) => s !== undefined) ?? [],
      },
    });
  }
}
```

### Step 3: Remove Unused Constants

Remove:
```typescript
const MAX_STEPS = 10;
```

### Step 4: Update Logger Service Name

Change:
```typescript
service: "chat-api",
```

To:
```typescript
service: "chat-api-agentic",
```

## Migration Notes

### What Changes
- Main LLM call uses orchestrator instead of `streamText`
- Tools are no longer passed directly to `streamText`
- Orchestrator manages sub-agent delegation
- **Orchestrator uses user's selected model dynamically**
- **Sub-agents use SAME model as orchestrator**

### What Stays Same
- Message persistence with Convex
- UI streaming with `createUIMessageStream`
- Suggestions generation
- Error handling patterns
- Context gathering (location, verification, etc.)
- **User can still select any model they want**

### Model Flow

```
User selects model → Orchestrator uses that model
                            ↓
                     Delegates to sub-agents
                            ↓
               Sub-agents use SAME model
               (all agents use user's selection)
```

### Rollback Plan
Keep old code commented out:
```typescript
// LEGACY: Direct streamText approach
// const streamTextResult = streamText({...});

// NEW: Orchestrator approach with dynamic model
const orchestrator = createOrchestratorAgent(writer, selectedModel, ...);
```

## Commands

```bash
pnpm lint
pnpm --filter www typecheck
pnpm test
```
