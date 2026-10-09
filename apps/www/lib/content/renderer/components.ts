import "server-only";

import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Array as Arr, Effect, Option, Record as Rec } from "effect";
import {
  RendererImplementationMissing,
  type RendererSelection,
  selectRendererImplementations,
} from "@/lib/content/renderer/selection";

function findSemanticComponent(componentName: string) {
  return Option.flatMapNullishOr(
    Arr.findFirst(
      Rec.toEntries(semanticMdxComponents),
      ([name]) => name === componentName
    ),
    ([, component]) => component
  );
}

/** Resolves exactly the registered implementations named by an authenticated payload. */
export const resolveRendererComponents = Effect.fn(
  "NakafaContent.resolveRendererComponents"
)(function* (selection: RendererSelection) {
  const selectedRenderers = yield* selectRendererImplementations(selection);
  const components: MDXComponents = { ...semanticMdxComponents };
  for (const renderer of selectedRenderers) {
    if (renderer.kind === "implementation") {
      components[renderer.name] = renderer.component;
      continue;
    }
    const component = findSemanticComponent(renderer.name);
    if (Option.isNone(component)) {
      return yield* RendererImplementationMissing.make({
        componentName: renderer.name,
        contentKey: selection.contentKey,
        rendererDomain: selection.rendererDomain,
      });
    }
    components[renderer.name] = component.value;
  }
  return components;
});
