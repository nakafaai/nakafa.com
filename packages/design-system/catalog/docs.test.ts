// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { exportsOf, guideline, preview, readme } from "#catalog/docs";

const card = {
  name: "Badge",
  group: "Content",
  height: 120,
  source: "badge",
} as const;

const source = `
const badgeVariants = cva("");

/**
 * A short label of a status.
 *
 * A status badge always carries a word.
 */
function Badge() {
  return null;
}

export function BadgeGroup() {}
export const BADGE = 1;
export { Badge, badgeVariants as variants, type BadgeProps, };
`;

describe("guideline", () => {
  it.effect(
    "returns the doc comment above the card's component, without its frame",
    () =>
      Effect.gen(function* () {
        expect(yield* guideline(card, source)).toBe(
          "A short label of a status.\n\nA status badge always carries a word."
        );
      })
  );

  it.effect(
    "names the module and the component when the comment is missing",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          guideline(card, "function Badge() {}")
        );
        expect(error._tag).toBe("GuidelineError");
        expect(error.message).toContain(
          "components/ui/badge.tsx needs a doc comment on Badge"
        );
      })
  );
});

describe("exportsOf", () => {
  it("lists declared and listed exports once, by their exported names, without types", () => {
    expect(exportsOf(source)).toEqual([
      "BadgeGroup",
      "BADGE",
      "Badge",
      "variants",
    ]);
  });
});

describe("readme", () => {
  it("writes the guideline, the parts and the source path", () => {
    expect(readme(card, "A label.", ["Badge"])).toBe(
      "# Badge\n\nA label.\n\n## Parts\n\n- `Badge`\n\n## Source\n\n- `packages/design-system/components/ui/badge.tsx`\n"
    );
  });
});

describe("preview", () => {
  it("opens with the card marker and mounts the card from the bundle", () => {
    const html = preview(card);
    expect(html.split("\n")[0]).toBe(
      '<!-- @dsCard group="Content" height=120 -->'
    );
    expect(html).toContain('window.Nakafa.showcase("Badge");');
  });
});
