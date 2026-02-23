# Agentic AI Migration Plan

## Overview

Replace the current flat tool-based chat system in `@apps/www/app/api/chat/route.ts` with a scalable **Orchestrator-Agent Architecture** using AI SDK's `ToolLoopAgent` (exported as `Experimental_Agent`).

**Key References:**
- AI SDK v6.0.97 Agent Types: `node_modules/ai/dist/index.d.mts` (lines showing `ToolLoopAgent`, `Experimental_Agent`, `InferAgentUIMessage`)
- AI SDK Building Agents: `node_modules/ai/docs/03-agents/02-building-agents.mdx`
- AI SDK Subagents: `node_modules/ai/docs/03-agents/06-subagents.mdx`
- AI SDK Workflows: `node_modules/ai/docs/03-agents/03-workflows.mdx`

---

## Current Architecture

```
User Request → streamText() → Flat Tools → Response
                    ↓
            [getContent, getArticles, getSubjects, 
             calculator, scrape, webSearch]
```

**Issues:**
1. All tools exposed directly - no organization by capability
2. Sequential execution only
3. Single context window gets polluted
4. No specialized handling for different task types

---

## Proposed Architecture

```
User Request → Orchestrator Agent (Nina)
                     │
       ┌─────────────┼───────────────┬────────────────┐
       ▼             ▼               ▼                ▼
  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────┐
  │ Research │ │ Content  │ │  Analysis   │ │     Web      │
  │  Agent   │ │  Agent   │ │   Agent     │ │    Agent     │
  ├──────────┤ ├──────────┤ ├─────────────┤ ├──────────────┤
  │webSearch │ │getContent│ │ calculator  │ │   scrape     │
  │getSubject│ │          │ │             │ │              │
  │getArticle│ │          │ │             │ │              │
  └──────────┘ └──────────┘ └─────────────┘ └──────────────┘
```

---

## Task Index

### Phase 1: Foundation
1. [Task 1.1: Create Agent Schemas](./task-1.1-agent-schemas.md)
2. [Task 1.2: Create Agent Prompt Utilities](./task-1.2-agent-prompts.md)
3. [Task 1.3: Create Tool Registry](./task-1.3-tool-registry.md)

### Phase 2: Sub-Agents
4. [Task 2.1: Create Research Agent](./task-2.1-research-agent.md)
5. [Task 2.2: Create Content Agent](./task-2.2-content-agent.md)
6. [Task 2.3: Create Analysis Agent](./task-2.3-analysis-agent.md)
7. [Task 2.4: Create Web Agent](./task-2.4-web-agent.md)

### Phase 3: Orchestrator
8. [Task 3.1: Create Orchestrator Agent](./task-3.1-orchestrator.md)

### Phase 4: Integration
9. [Task 4.1: Refactor Chat Route](./task-4.1-refactor-chat-route.md)

### Phase 5: Testing
10. [Task 5.1: Create Agent Tests](./task-5.1-agent-tests.md)

---

## Tool Grouping by Purpose

Based on analysis of `@packages/ai/tools/`:

| Agent | Tools | Purpose |
|-------|-------|---------|
| **Research** | webSearch, getSubjects, getArticles | Information discovery, searching, finding content |
| **Content** | getContent | Retrieving specific Nakafa educational content |
| **Analysis** | calculator | Mathematical calculations and data processing |
| **Web** | scrape | External URL scraping |

---

## Verification Commands

```bash
# Type checking
pnpm --filter @repo/ai typecheck
pnpm --filter www typecheck

# Linting
pnpm lint

# Testing
pnpm test
```

---

## Implementation Notes

### Why This Architecture?

1. **Context Isolation**: Each sub-agent has isolated context via `toModelOutput` pattern (AI SDK subagents doc)
2. **Parallel Execution**: Multiple sub-agents can run simultaneously when independent
3. **Scalability**: Easy to add new specialized agents
4. **Maintainability**: Clear separation of concerns
5. **Type Safety**: Full TypeScript with Zod schemas

### Key Patterns

1. **Zod Schemas**: All configurations use Zod for runtime validation
2. **Prompt Files**: Each agent has its own `prompt.ts` using `createPrompt` utility
3. **Factory Pattern**: Agents are created via factory functions with injected dependencies
4. **Tool Registry**: Centralized registry for dynamic tool discovery

### References

- **AI SDK Agent Export**: `ToolLoopAgent as Experimental_Agent` in `node_modules/ai/dist/index.d.mts`
- **Current Chat Route**: `apps/www/app/api/chat/route.ts` (494 lines)
- **Prompt Utils**: `packages/ai/prompt/utils.ts` with `createPrompt` function
- **Existing Tools**: `packages/ai/tools/*.ts` (6 tools total)

---

## Migration Strategy

1. **Implement in order** - Each phase builds on previous
2. **Run lint/typecheck after each task**
3. **Test incrementally** - Don't wait until end
4. **Keep old code** - Comment out initially for easy rollback
5. **Feature flag** - Deploy behind flag for gradual rollout
