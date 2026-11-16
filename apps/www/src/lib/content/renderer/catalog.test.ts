import { describe, expect, it } from "@effect/vitest";
import {
  FIGURE_NAMES,
  VISUAL_NAMES,
} from "@nakafa/aksara-contracts/visual/catalog";
import { Array as Arr, Option, Order } from "effect";
import {
  catalogRenderer,
  catalogRenderers,
} from "@/lib/content/renderer/catalog";

vi.mock("use-intl", () => ({
  /** Keeps registry discovery independent from navigation runtime behavior. */
  useTranslations: () => () => "",
}));

describe("catalog renderers", () => {
  it("register exactly the components of the Visual Catalog, once each", () => {
    const names = Arr.map(catalogRenderers, ({ name }) => name);

    expect(Arr.sort(names, Order.String)).toEqual(VISUAL_NAMES);
  });

  it("draw every catalog figure an assessment may place, and nothing else", () => {
    for (const name of FIGURE_NAMES) {
      expect(Option.isSome(catalogRenderer(name))).toBe(true);
    }
    expect(Option.isNone(catalogRenderer("Widget"))).toBe(true);
  });
});
