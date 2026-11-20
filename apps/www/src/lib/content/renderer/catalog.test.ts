import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import type {
  FigureName,
  visualCatalog,
} from "@nakafa/aksara-contracts/visual/catalog";
import {
  FIGURE_NAMES,
  VISUAL_NAMES,
} from "@nakafa/aksara-contracts/visual/catalog";
import type { Types } from "effect";
import { Array as Arr, Option, Order } from "effect";
import type { ComponentType, ReactNode } from "react";
import {
  catalogRenderer,
  catalogRenderers,
} from "@/lib/content/renderer/catalog";

/**
 * The props a document may give each catalog component. The renderer draws every rich slot as an element
 * (`mapRichProps`), never as nothing, so a slot is a React node that is never null.
 */
type DocumentProps = ReturnType<typeof visualCatalog<NonNullable<ReactNode>>>;

/**
 * The name of a figure whose renderer would refuse props its Schema accepts:
 * the Schema's props do not fit the component's, or the Schema names a prop
 * the component lacks. The renderer hands each component a value it has just
 * decoded, so the readonly marks the Schema's encoded type carries do not
 * count. A markup component takes its children from the tree, so only figures
 * are held to their props.
 */
type Refused<Renderer> = Renderer extends {
  readonly component: ComponentType<infer Props>;
  readonly name: infer Name extends FigureName;
}
  ? [Types.DeepMutable<DocumentProps[Name]["props"]["Encoded"]>] extends [Props]
    ? [
        Exclude<keyof DocumentProps[Name]["props"]["Encoded"], keyof Props>,
      ] extends [never]
      ? never
      : Name
    : Name
  : never;

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

  it("accept every prop a figure's Schema accepts, and no prop it lacks", () => {
    expectTypeOf<
      Refused<(typeof catalogRenderers)[number]>
    >().toEqualTypeOf<never>();
  });
});
