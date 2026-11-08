import { describe, expect, it } from "@effect/vitest";
import { MathAppearanceSchema } from "@nakafa/aksara-contracts/math/base";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Order, Record as Rec } from "effect";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";

describe("MathVisual palette", () => {
  it("gives every appearance its own plot color", () => {
    const resolved = Arr.map(
      MathAppearanceSchema.literals,
      resolveMathAppearance
    );

    expect(Arr.sort(resolved, Order.String)).toStrictEqual(
      Arr.sort(Rec.values(PLOT_COLORS), Order.String)
    );
  });
});
