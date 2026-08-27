import { describe, expect, it } from "@effect/vitest";
import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { taxonomy } from "@repo/ai/agents/nakafa/tools/taxonomy";
import {
  createNakafaTestService,
  createWriter,
} from "@repo/ai/agents/nakafa/tools/test";
import { Effect } from "effect";

describe("nakafa taxonomy tool", () => {
  it.effect("writes loading and done parts for taxonomy", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* taxonomy({
        input: { locale: "en" },
        locale: "id",
        toolCallId: "taxonomy-1",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));

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
    })
  );

  it.effect(
    "uses the injected test service for invalid route verification",
    () =>
      Effect.gen(function* () {
        const service = createNakafaTestService();
        const isVerified = yield* service.verify("");
        const taxonomyResult = yield* service.taxonomy();

        expect(isVerified).toBe(false);
        expect(taxonomyResult.locale).toBe("en");
      })
  );
});
