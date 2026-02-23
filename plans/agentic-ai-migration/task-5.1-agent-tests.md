# Task 5.1: Create Agent Tests

## Goal
Create tests for agent functionality

## Context
Uses Vitest for testing agent behavior

## Implementation

**File**: `packages/ai/agents/__tests__/orchestrator.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { createOrchestratorAgent, routeToAgent } from "../orchestrator";
import { isMathematicalQuery, shouldUseMathAgent } from "../math";
import { isExternalUrl, extractUrlFromQuery } from "../research";
import { isContentQuery } from "../study";

describe("Orchestrator", () => {
  const mockWriter = {
    write: vi.fn(),
    merge: vi.fn(),
  };

  describe("routeToAgent", () => {
    it("should route math queries to math agent", () => {
      const result = routeToAgent({ query: "Calculate 15 * 23" });
      expect(result.agent).toBe("math");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should route URLs to research agent", () => {
      const result = routeToAgent({ query: "Analyze https://example.com" });
      expect(result.agent).toBe("research");
      expect(result.confidence).toBe(0.9);
    });

    it("should route web search to research agent", () => {
      const result = routeToAgent({ query: "Search for quantum computing" });
      expect(result.agent).toBe("research");
    });

    it("should route Nakafa content to study agent", () => {
      const result = routeToAgent({ query: "Find articles about physics" });
      expect(result.agent).toBe("study");
    });

    it("should return null for simple queries", () => {
      const result = routeToAgent({ query: "Hello" });
      expect(result.agent).toBeNull();
    });
  });

  describe("createOrchestratorAgent", () => {
    it("should create agent with correct configuration", () => {
      const agent = createOrchestratorAgent({
        writer: mockWriter as any,
        selectedModel: "claude-sonnet-4-20250514",
        context: {
          url: "/test",
          currentPage: { locale: "en", slug: "test", verified: true },
          currentDate: "2025-01-01",
          userLocation: { city: "Test", country: "TC" },
        }
      });

      expect(agent).toBeDefined();
    });
  });
});
```

**File**: `packages/ai/agents/__tests__/math.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isMathematicalQuery, shouldUseMathAgent } from "../math";

describe("Math Agent", () => {
  describe("isMathematicalQuery", () => {
    it("should detect arithmetic", () => {
      expect(isMathematicalQuery("2 + 2")).toBeGreaterThan(0.5);
      expect(isMathematicalQuery("15 * 23")).toBeGreaterThan(0.5);
    });

    it("should detect math keywords", () => {
      expect(isMathematicalQuery("Calculate the average")).toBeGreaterThan(0.5);
      expect(isMathematicalQuery("Solve this equation")).toBeGreaterThan(0.5);
    });

    it("should return low score for non-math", () => {
      expect(isMathematicalQuery("Hello world")).toBeLessThan(0.5);
    });
  });

  describe("shouldUseMathAgent", () => {
    it("should return true for math queries", () => {
      expect(shouldUseMathAgent("What is 10 + 5?")).toBe(true);
    });

    it("should return false for non-math", () => {
      expect(shouldUseMathAgent("Tell me a story")).toBe(false);
    });
  });
});
```

**File**: `packages/ai/agents/__tests__/research.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isExternalUrl, validateUrl, extractUrlFromQuery } from "../research";

describe("Research Agent", () => {
  describe("isExternalUrl", () => {
    it("should allow external URLs", () => {
      expect(isExternalUrl("https://example.com")).toBe(true);
      expect(isExternalUrl("https://google.com")).toBe(true);
    });

    it("should block Nakafa URLs", () => {
      expect(isExternalUrl("https://nakafa.com")).toBe(false);
      expect(isExternalUrl("https://www.nakafa.com/page")).toBe(false);
    });

    it("should block localhost", () => {
      expect(isExternalUrl("http://localhost:3000")).toBe(false);
      expect(isExternalUrl("http://127.0.0.1")).toBe(false);
    });
  });

  describe("validateUrl", () => {
    it("should validate good URLs", () => {
      const result = validateUrl("https://example.com");
      expect(result.valid).toBe(true);
      expect(result.external).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const result = validateUrl("not-a-url");
      expect(result.valid).toBe(false);
    });

    it("should reject Nakafa URLs", () => {
      const result = validateUrl("https://nakafa.com");
      expect(result.valid).toBe(false);
    });
  });

  describe("extractUrlFromQuery", () => {
    it("should extract URLs from text", () => {
      const query = "Check out https://example.com for more info";
      expect(extractUrlFromQuery(query)).toBe("https://example.com");
    });

    it("should return null if no URL", () => {
      expect(extractUrlFromQuery("No URL here")).toBeNull();
    });
  });
});
```

**File**: `packages/ai/agents/__tests__/study.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isContentQuery } from "../study";

describe("Study Agent", () => {
  describe("isContentQuery", () => {
    it("should detect content queries", () => {
      expect(isContentQuery("Find articles about physics")).toBe(true);
      expect(isContentQuery("Get content for slug math-algebra")).toBe(true);
    });

    it("should detect subject queries", () => {
      expect(isContentQuery("List all subjects")).toBe(true);
      expect(isContentQuery("What subjects are available?")).toBe(true);
    });

    it("should return false for non-content queries", () => {
      expect(isContentQuery("Hello world")).toBe(false);
      expect(isContentQuery("Calculate 2+2")).toBe(false);
    });
  });
});
```

## Commands

```bash
pnpm --filter @repo/ai test
pnpm --filter @repo/ai exec vitest run
```
