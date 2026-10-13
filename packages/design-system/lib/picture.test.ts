import { describe, expect, it } from "@effect/vitest";
import { pictureHeight } from "@repo/design-system/lib/picture";

describe("pictureHeight", () => {
  it.each([
    // 181.87 rounds up, so a floor would give 181.
    { box: [-48, -20, 300, 310], want: 182, width: 176 },
    // 103.33 rounds down, so a ceiling would give 104.
    { box: [-48, -20, 300, 310], want: 103, width: 100 },
    // A square window gives a square picture.
    { box: [0, 0, 200, 200], want: 96, width: 96 },
    // A window taller than it is wide gives a picture taller than it is wide.
    { box: [0, 0, 120, 240], want: 120, width: 60 },
  ] as const)(
    "gives $want pixels at $width wide in the window $box",
    ({ box, want, width }) => {
      expect(pictureHeight(width, box)).toBe(want);
    }
  );
});
