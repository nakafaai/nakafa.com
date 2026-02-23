# Task 1.2: Create Agent Prompt Files

## Goal
Create prompt files for each agent following the existing pattern in `packages/ai/prompt/tools/*.ts` and preserving Nina's personality from `packages/ai/prompt/system.ts`.

## Context
Each agent needs a prompt file that defines its behavior and maintains Nina's consistent personality across the agent system.

## Files to Create

### 1. Agent Prompt Files
Create the following files in `packages/ai/prompt/agents/`:

- `research.ts` - Research agent prompts (web search & scraping)
- `study.ts` - Study agent prompts (Nakafa content retrieval)
- `math.ts` - Math agent prompts (calculations)
- `orchestrator.ts` - Orchestrator prompts
- `descriptions.ts` - Centralized descriptions for agents and tools

### 2. Pattern to Follow

**Reference**: `packages/ai/prompt/tools/calculator.ts`

All prompts should:
1. Use `createPrompt()` utility from `@repo/ai/prompt/utils`
2. Reference Nina's team (e.g., "working as part of Nina's team")
3. Maintain consistent personality traits:
   - Friendly, supportive, patient
   - Casual, never formal
   - Brutally honest advisor
   - Challenge thinking, expose blind spots
4. Export both:
   - `{agentName}Prompt()` - Returns full prompt string
   - `{agentName}Description()` - Returns short description string

### 3. Personality Preservation

**Reference**: `packages/ai/prompt/system.ts` lines 67-95

Key traits to preserve in all agent prompts:
- "You are a specialized [role] working as part of Nina's team..."
- Stay in character as real human assistant
- Never mention AI, tools, functions, or internal processes
- Be brutally honest, challenge assumptions
- Give precise, prioritized plans

### 4. Centralized Descriptions

Create `descriptions.ts` with:
- Agent descriptions (research, study, math)
- Tool descriptions (webSearch, scrape, getSubjects, getArticles, getContent, calculator)
- Delegate tool description for orchestrator

This prevents hardcoding strings in implementation files.

## AI SDK References

- **Building Agents**: https://ai-sdk.dev/docs/agents/building-agents#model-and-system-instructions
- **Prompt Engineering**: Follow existing patterns in `packages/ai/prompt/tools/*.ts`

## Verification Steps

1. All prompts reference Nina's team
2. Consistent personality across all agents
3. Descriptions centralized in `descriptions.ts`
4. No hardcoded description strings in agent implementation files

## Commands

```bash
pnpm lint
pnpm --filter @repo/ai typecheck
```
