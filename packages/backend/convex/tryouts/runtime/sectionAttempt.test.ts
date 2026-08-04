import { requireInternalEntrySection } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
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

    expect(() => requireInternalEntrySection(sections, "entry")).not.toThrow();
  });

  it.each(unavailableSections)(
    "rejects unavailable entry section $sectionKey",
    (section) => {
      expect(() => requireInternalEntrySection([section], "entry")).toThrow(
        "TRYOUT_ENTRY_SECTION_NOT_FOUND"
      );
    }
  );
});
