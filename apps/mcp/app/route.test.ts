import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import * as route from "@/app/route";

describe("MCP root route", () => {
  it.effect("explains the canonical and direct MCP endpoints", () =>
    Effect.gen(function* () {
      const response = route.GET();
      const text = yield* Effect.promise(() => response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8"
      );
      expect(text).toContain("https://mcp.nakafa.com is informational only");
      expect(text).toContain(
        "Use https://nakafa.com/mcp as the recommended MCP endpoint"
      );
      expect(text).toContain(
        "Use https://mcp.nakafa.com/mcp as the direct MCP endpoint"
      );
      expect(text).toContain("nakafa_get_quran_reference_v2");
      expect(text).toContain("semantic notes and signed source attribution");
    })
  );

  it("does not expose root as a transport endpoint", () => {
    expect("POST" in route).toBe(false);
  });
});
