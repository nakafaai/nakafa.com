import type { ContentKey } from "@nakafa/aksara-contracts/ids";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import {
  type ContentTreeElement,
  type ContentTreeProps,
  type ContentTreeValue,
  contentTreeComponentNames,
} from "@nakafa/aksara-contracts/tree";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Array as Arr, Effect, Predicate, Record as Rec } from "effect";
import { createElement, Fragment, type ReactElement } from "react";
import { RendererImplementationMissing } from "@/lib/content/renderer/selection";

/** The element that renders its children without an element of its own. */
const FRAGMENT = "fragment";

/** Checks whether one tree value is an element rather than JSON data or a list. */
function isElement(value: ContentTreeValue): value is ContentTreeElement {
  return (
    Predicate.isObject(value) &&
    !Arr.isArray(value) &&
    Predicate.hasProperty(value, "$node")
  );
}

/** Checks whether one tree value is a list of tree values. */
function isList(value: ContentTreeValue): value is readonly ContentTreeValue[] {
  return Arr.isArray(value);
}

/** Checks whether one tree value is a plain props object, never an element or a list. */
function isRecord(value: ContentTreeValue): value is ContentTreeProps {
  return Predicate.isObject(value) && !Arr.isArray(value);
}

/** Renders one prop value: nested elements become React elements, JSON data passes through. */
function renderValue(
  value: ContentTreeValue,
  components: MDXComponents
): unknown {
  if (isElement(value)) {
    return renderElement(value, components);
  }
  if (isList(value)) {
    return Arr.map(value, (item) => renderValue(item, components));
  }
  if (isRecord(value)) {
    return Rec.map(value, (item) => renderValue(item, components));
  }
  return value;
}

/**
 * Renders one element with the component map. An intrinsic tag resolves through
 * the same map and stays the literal tag when the map has no entry for it, so
 * `br` is never mapped.
 */
function renderElement(
  element: ContentTreeElement,
  components: MDXComponents
): ReactElement {
  const type =
    element.name === FRAGMENT
      ? Fragment
      : (components[element.name] ?? element.name);
  const props = Rec.map(element.props, (value) =>
    renderValue(value, components)
  );
  const children = Arr.map(element.children, (child) =>
    typeof child === "string" ? child : renderElement(child, components)
  );
  return createElement(type, props, ...children);
}

/**
 * Renders the signed content tree as React elements with the resolved component
 * map. Nothing is evaluated: every node is data the verifier already authenticated.
 * A component the tree names without an implementation fails as the renderer's
 * missing-implementation error before any element is created.
 */
export const renderContentTree = Effect.fn("NakafaContent.renderContentTree")(
  function* (
    components: MDXComponents,
    contentKey: ContentKey,
    rendererDomain: RendererDomain,
    tree: ContentTreeElement
  ) {
    for (const componentName of contentTreeComponentNames(tree)) {
      if (components[componentName] === undefined) {
        return yield* new RendererImplementationMissing({
          componentName,
          contentKey,
          rendererDomain,
        });
      }
    }
    return renderElement(tree, components);
  }
);
