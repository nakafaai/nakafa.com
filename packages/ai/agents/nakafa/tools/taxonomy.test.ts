import { taxonomy } from "@repo/ai/agents/nakafa/tools/taxonomy";
import { createWriter } from "@repo/ai/agents/nakafa/tools/test";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("nakafa taxonomy tool", () => {
  it("writes loading and done parts for taxonomy", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      taxonomy({
        input: { locale: "en" },
        toolCallId: "taxonomy-1",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(output).toContain("# Nakafa Taxonomy");
    expect(parts).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "taxonomy",
          status: "loading",
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "taxonomy",
          status: "done",
          result: expect.objectContaining({
            sections: expect.arrayContaining(["articles"]),
          }),
        }),
      }),
    ]);
  });
});
