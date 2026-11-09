// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type {
  ContentTreeChild,
  ContentTreeElement,
  ContentTreeProps,
} from "@nakafa/aksara-contracts/tree";
import { contentOutline } from "@repo/contents/toc";
import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import { Array as Arr, Effect, Schema } from "effect";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TAKES_LOCALE } from "@/lib/content/renderer/locale";
import { renderContentTree } from "@/lib/content/renderer/tree";

const contentKey = ContentKeySchema.make("test:tree");

/** Any React child, which the test passes through unchanged. */
const ReactNodeSchema = Schema.declare(
  (value: unknown): value is ReactNode => value !== undefined
);

const ProbeProps = Schema.Struct({
  icon: ReactNodeSchema,
  label: Schema.String,
});

const ValuesProps = Schema.Struct({
  count: Schema.Finite,
  flag: Schema.Boolean,
  items: Schema.Array(Schema.Unknown),
  meta: Schema.Struct({ a: Schema.Finite }),
  none: Schema.Null,
});

/** Test component that renders its label followed by one nested element. */
function Probe(props: typeof ProbeProps.Type) {
  return createElement("span", null, props.label, props.icon);
}

/** Test component that renders JSON data props exactly as they arrived. */
function Values(props: typeof ValuesProps.Type) {
  const items = Arr.join(Arr.map(props.items, String), ",");
  return createElement(
    "span",
    null,
    `${props.count}|${props.flag}|${props.none}|${items}|${props.meta.a}`
  );
}

/** Test component that draws the locale the tree gave it. */
const Localized = Object.assign(
  (props: { readonly locale?: string; readonly label: string }) =>
    createElement("span", null, `${props.label}@${props.locale ?? "none"}`),
  { [TAKES_LOCALE]: true }
);

const components = {
  ...semanticMdxComponents,
  Localized,
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
  return renderContentTree(
    components,
    contentKey,
    "site",
    tree,
    ArtifactLocaleSchema.make("de")
  ).pipe(Effect.map((blocks) => createElement(Fragment, null, ...blocks)));
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
    "renders a fragment inside a block without an element of its own",
    () =>
      Effect.gen(function* () {
        const element = yield* renderTree(
          root([node("div", [node("fragment", [node("section", ["a"]), "b"])])])
        );

        expect(renderToStaticMarkup(element)).toBe(
          "<div><section>a</section>b</div>"
        );
      })
  );

  it.effect("keeps the text between the root's blocks as text", () =>
    Effect.gen(function* () {
      const element = yield* renderTree(
        root([node("div", ["first"]), "\n", node("section", ["second"])])
      );

      expect(renderToStaticMarkup(element)).toBe(
        "<div>first</div>\n<section>second</section>"
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
          "<span>Label<em>nested</em></span><span>3|true|null|a,1,null|7</span>"
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
  it.effect(
    "gives the artifact's locale to a component marked to take it, and to no other",
    () =>
      Effect.gen(function* () {
        const element = yield* renderTree(
          root([
            node("Localized", [], { label: "marked" }),
            node("Probe", [], { icon: null, label: "unmarked" }),
          ])
        );

        expect(renderToStaticMarkup(element)).toBe(
          "<span>marked@de</span><span>unmarked</span>"
        );
      })
  );
  it.effect(
    "gives every heading the anchor that the page's outline links to",
    () =>
      Effect.gen(function* () {
        const tree = root([
          node("h2", ["Heading with ", node("strong", ["bold"]), " words"]),
          node("p", ["Body"]),
          node("h3", ["Rate ", node("code", ["k"])]),
          node("h3", ["Authored"], { id: "own" }),
        ]);
        const markup = renderToStaticMarkup(yield* renderTree(tree));
        const ids = Arr.map(
          Arr.fromIterable(markup.matchAll(/<h[23][^>]* id="(?<id>[^"]+)"/gu)),
          (match) => `#${match[1]}`
        );

        expect(ids).toEqual(
          Arr.flatMap(contentOutline(tree), (heading) => [
            heading.href,
            ...Arr.map(heading.children, (child) => child.href),
          ])
        );
        expect(ids).toEqual(["#heading-with-bold-words", "#rate-k", "#own"]);
      })
  );
});
