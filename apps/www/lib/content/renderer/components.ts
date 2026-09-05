import "server-only";

import { semanticMdxComponents } from "@repo/design-system/lib/markdown/semantic";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect } from "effect";
import {
  RendererImplementationMissing,
  type RendererSelection,
  selectRendererImplementations,
} from "@/lib/content/renderer/selection";

function findSemanticComponent(componentName: string) {
  return Object.entries(semanticMdxComponents).find(
    ([name]) => name === componentName
  )?.[1];
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
    if (component === undefined) {
      return yield* new RendererImplementationMissing({
        componentName: renderer.name,
        contentKey: selection.contentKey,
        rendererDomain: selection.rendererDomain,
      });
    }
    components[renderer.name] = component;
  }
  return components;
});
