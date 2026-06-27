---
title: AI SDK DevTools
description: Debug AI SDK calls by inspecting captured runs and steps.
---

# AI SDK DevTools

Source: https://ai-sdk.dev/v7/docs/ai-sdk-core/devtools

## Why Use DevTools

DevTools captures all AI SDK calls (`generateText`, `streamText`, `ToolLoopAgent`) to a local JSON file. This lets you inspect LLM requests, responses, tool calls, and multi-step interactions without manually logging.

## Setup

Requires AI SDK 7 and a Node.js-compatible local runtime. Install `@ai-sdk/devtools` using your project's package manager.

Register the DevTools telemetry integration once at an app/server startup boundary:

```ts
import { DevToolsTelemetry } from '@ai-sdk/devtools';
import { registerTelemetry } from 'ai';

registerTelemetry(DevToolsTelemetry());
```

After registration, AI SDK calls emit DevTools telemetry by default. Keep this local-only because prompts, outputs, and tool data are written in plaintext.

## Viewing Captured Data

All runs and steps are saved to:

```
.devtools/generations.json
```

Read this file directly to inspect captured data:

```bash
cat .devtools/generations.json | jq
```

Or launch the web UI:

```bash
npx @ai-sdk/devtools
# Open http://localhost:4983
```

## Data Structure

- **Run**: A complete multi-step interaction grouped by initial prompt
- **Step**: A single LLM call within a run (includes input, output, tool calls, token usage)
