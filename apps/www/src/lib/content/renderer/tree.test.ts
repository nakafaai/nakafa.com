// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import type {
  ContentTreeChild,
  ContentTreeElement,
  ContentTreeProps,
} from "@nakafa/aksara-contracts/tree";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import { Effect } from "effect";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderContentTree } from "@/lib/content/renderer/tree";

const contentKey = ContentKeySchema.make("test:tree");

/** Test component that renders its label followed by one nested element. */
function Probe(props: { readonly icon: ReactNode; readonly label: string }) {
  return createElement("span", null, props.label, props.icon);
}

/** Test component that renders JSON data props exactly as they arrived. */
function Values(props: {
  readonly count: number;
  readonly flag: boolean;
  readonly items: readonly unknown[];
  readonly meta: { readonly a: number };
  readonly none: null;
}) {
  return createElement(
    "span",
    null,
    `${props.count}|${props.flag}|${props.none}|${props.items.join(",")}|${props.meta.a}`
  );
}

const components = {
  ...semanticMdxComponents,
  Probe,
  Values,
};

/** Builds one element of the tree with its props and children. */
function node(
  name: string,
  children: readonly ContentTreeChild[] = [],
  props: ContentTreeProps = {}
): ContentTreeElement {
  return { $node: "element", children, name, props };
}

/** Builds the fragment that roots every content tree. */
function root(children: readonly ContentTreeChild[]): ContentTreeElement {
  return node("fragment", children);
}

/** Renders one tree through the component map used by every artifact. */
function renderTree(tree: ContentTreeElement) {
  return renderContentTree({
    components,
    contentKey,
    rendererDomain: "site",
    tree,
  });
}

describe("content tree rendering", () => {
  it.effect(
    "renders the fragment and intrinsic tags through the semantic map",
    () =>
      Effect.gen(function* () {
        const element = yield* renderTree(
          root([
            node("h2", ["Title"]),
            node("p", ["Plain ", node("em", ["stressed"]), node("br"), "tail"]),
          ])
        );
        const markup = renderToStaticMarkup(element);

        expect(markup).toContain('<h2 class="');
        expect(markup).toContain('id="title"');
        expect(markup).toContain("stressed</em>");
        expect(markup).toContain("<br/>");
        expect(markup).toContain("tail</p>");
      })
  );

  it.effect(
    "keeps an intrinsic tag without a semantic entry as the literal element",
    () =>
      Effect.gen(function* () {
        const element = yield* renderTree(
          root([node("div", ["x"]), node("section", ["y"])])
        );

        expect(renderToStaticMarkup(element)).toBe(
          "<div>x</div><section>y</section>"
        );
      })
  );

  it.effect(
    "renders nested elements in props and passes JSON data through unchanged",
    () =>
      Effect.gen(function* () {
        const element = yield* renderTree(
          root([
            node("Probe", [], {
              icon: node("em", ["nested"]),
              label: "Label",
            }),
            node("Values", [], {
              count: 3,
              flag: true,
              items: ["a", 1, null],
              meta: { a: 7 },
              none: null,
            }),
          ])
        );

        expect(renderToStaticMarkup(element)).toBe(
          "<span>Label<em>nested</em></span><span>3|true|null|a,1,|7</span>"
        );
      })
  );

  it.effect(
    "fails with the renderer's missing implementation for a component without an entry",
    () =>
      Effect.gen(function* () {
        const failure = yield* renderTree(
          root([node("p", [node("NoSuchComponent")])])
        ).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "NoSuchComponent",
          contentKey,
          rendererDomain: "site",
        });
      })
  );

  it.effect(
    "fails for a missing component that only a nested prop element names",
    () =>
      Effect.gen(function* () {
        const failure = yield* renderTree(
          root([
            node("Probe", [], {
              icon: node("NestedMissing"),
              label: "Label",
            }),
          ])
        ).pipe(Effect.flip);

        expect(failure).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "NestedMissing",
        });
      })
  );
});
