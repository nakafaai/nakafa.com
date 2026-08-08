import { requireInternalEntrySection } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const unavailableSections: Parameters<typeof requireInternalEntrySection>[0] = [
  { sectionKey: "entry", visibility: "visible" },
  { sectionKey: "another", visibility: "internal-entry" },
];

describe("tryouts/runtime/sectionAttempt", () => {
  it("accepts the requested internal entry section", () => {
    const sections: Parameters<typeof requireInternalEntrySection>[0] = [
      { sectionKey: "entry", visibility: "internal-entry" },
    ];

    expect(
      Effect.runSync(requireInternalEntrySection(sections, "entry"))
    ).toBeUndefined();
  });

  it.each(unavailableSections)(
    "rejects unavailable entry section $sectionKey",
    (section) => {
      const error = Effect.runSync(
        Effect.flip(requireInternalEntrySection([section], "entry"))
      );

      expect(error).toMatchObject({
        _tag: "TryoutRuntimeError",
        code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
      });
    }
  );
});
