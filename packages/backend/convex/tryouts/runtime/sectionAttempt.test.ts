import { requireInternalEntrySection } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const unavailableSections: Parameters<typeof requireInternalEntrySection>[0] = [
  { sectionKey: "entry", visibility: "visible" },
  { sectionKey: "another", visibility: "internal-entry" },
];

describe("tryouts/runtime/sectionAttempt", () => {
  it.live("accepts the requested internal entry section", () =>
    Effect.gen(function* () {
      const sections: Parameters<typeof requireInternalEntrySection>[0] = [
        { sectionKey: "entry", visibility: "internal-entry" },
      ];

      expect(
        yield* requireInternalEntrySection(sections, "entry")
      ).toBeUndefined();
    })
  );

  it.live.each(unavailableSections)(
    "rejects unavailable entry section $sectionKey",
    (section) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          requireInternalEntrySection([section], "entry")
        );

        expect(error).toMatchObject({
          _tag: "TryoutRuntimeError",
          code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
        });
      })
  );
});
