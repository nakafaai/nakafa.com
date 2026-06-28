import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { taxonomy } from "@repo/ai/agents/nakafa/tools/taxonomy";
import {
  createNakafaTestService,
  createWriter,
} from "@repo/ai/agents/nakafa/tools/test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("nakafa taxonomy tool", () => {
  it("writes loading and done parts for taxonomy", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      taxonomy({
        input: { locale: "en" },
        locale: "id",
        toolCallId: "taxonomy-1",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()))
    );

    expect(output).toContain("# Nakafa Taxonomy");
    expect(parts).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "taxonomy",
          input: { locale: "id" },
          status: "loading",
        }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "taxonomy",
          input: { locale: "id" },
          status: "done",
          result: expect.objectContaining({
            sections: expect.arrayContaining(["articles"]),
          }),
        }),
      }),
    ]);
  });

  it("uses the injected test service for invalid route verification", async () => {
    const service = createNakafaTestService();
    const isVerified = await Effect.runPromise(service.verify(""));
    const taxonomyResult = await Effect.runPromise(service.taxonomy());

    expect(isVerified).toBe(false);
    expect(taxonomyResult.locale).toBe("en");
  });
});
