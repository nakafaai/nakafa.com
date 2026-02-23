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
import { isMathematicalQuery } from "../analysis";
import { isExternalUrl, extractUrlFromQuery } from "../web";

describe("Orchestrator", () => {
  const mockWriter = {
    write: vi.fn(),
    merge: vi.fn(),
  };

  describe("routeToAgent", () => {
    it("should route math queries to analysis agent", () => {
      const result = routeToAgent("Calculate 15 * 23");
      expect(result.agent).toBe("analysis");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should route URLs to web agent", () => {
      const result = routeToAgent("Analyze https://example.com");
      expect(result.agent).toBe("web");
      expect(result.confidence).toBe(0.9);
    });

    it("should route research keywords to research agent", () => {
      const result = routeToAgent("Search for quantum computing");
      expect(result.agent).toBe("research");
    });

    it("should return null for simple queries", () => {
      const result = routeToAgent("Hello");
      expect(result.agent).toBeNull();
    });
  });

  describe("createOrchestratorAgent", () => {
    it("should create agent with correct configuration", () => {
      const agent = createOrchestratorAgent(mockWriter as any, {
        url: "/test",
        currentPage: { locale: "en", slug: "test", verified: true },
        currentDate: "2025-01-01",
        userLocation: { city: "Test", country: "TC" },
      });

      expect(agent).toBeDefined();
    });
  });
});
```

**File**: `packages/ai/agents/__tests__/analysis.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isMathematicalQuery, shouldUseAnalysisAgent } from "../analysis";

describe("Analysis Agent", () => {
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

  describe("shouldUseAnalysisAgent", () => {
    it("should return true for math queries", () => {
      expect(shouldUseAnalysisAgent("What is 10 + 5?")).toBe(true);
    });

    it("should return false for non-math", () => {
      expect(shouldUseAnalysisAgent("Tell me a story")).toBe(false);
    });
  });
});
```

**File**: `packages/ai/agents/__tests__/web.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isExternalUrl, validateUrl, extractUrlFromQuery } from "../web";

describe("Web Agent", () => {
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

## Commands

```bash
pnpm --filter @repo/ai test
pnpm --filter @repo/ai exec vitest run
```
