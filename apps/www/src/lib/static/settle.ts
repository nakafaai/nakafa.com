import { MathFontPreload } from "@repo/design-system/components/markdown/fonts";
import {
  isMathFont,
  loadMathFonts,
  type MathFont,
} from "@repo/design-system/lib/markdown/fonts";
import {
  Array as Arr,
  Duration,
  Effect,
  MutableHashSet,
  MutableList,
  Predicate,
  Record,
  Result,
} from "effect";

/**
 * The key under which a TanStack Start server component holds the getter of
 * its decoded tree. It is a registered symbol, the one Start's own renderer
 * reads, so the app reaches the same getter.
 */
const TREE_GETTER = Symbol.for("tanstack.rsc.getTree");

/** React's mark on a lazy node: the Flight client makes one for each part of a tree it reads later. */
const LAZY_NODE = Symbol.for("react.lazy");

/** React's mark on an element, which the Flight client gives every element it decodes. */
const ELEMENT = Symbol.for("react.transitional.element");

/**
 * The longest a navigation waits for its math faces. KaTeX's faces load with
 * `font-display: block`, so after this the browser draws the formulas in a
 * fallback face anyway, and waiting longer would only hold the page back.
 */
const MATH_FONT_WAIT = Duration.seconds(3);

/**
 * The key under which an app component that renders a lazy component of its
 * own exposes that lazy component, so settling loads it with the tree. A lazy
 * component inside another component is beyond the tree's reach otherwise, and
 * its first render would draw nothing until its code arrives.
 */
export const SETTLED_RENDERER = Symbol.for("nakafa.settle.renderer");

/** The most times one lazy node is read while the parts it waits on arrive. */
const MAX_READS = 64;

/** Whether a value is a lazy node, whose content React reads with its `_init`. */
function isLazyNode(value: object) {
  return Reflect.get(value, "$$typeof") === LAZY_NODE;
}

/** Whether a value is a React element, whose type and props are all a render reads. */
function isElement(value: object) {
  return Reflect.get(value, "$$typeof") === ELEMENT;
}

/**
 * Reads one lazy node the way React's render reads it, so its content is
 * parsed before the render that shows it. A node whose part waits for another
 * throws that part's thenable, which is awaited before the next read. A node
 * that fails is left for the render, which shows its failure where it belongs.
 */
const readLazyNode = Effect.fn("www.static.readLazyNode")(function* (
  node: object
) {
  const init = Reflect.get(node, "_init");
  if (!Predicate.isFunction(init)) {
    return;
  }
  for (let read = 0; read < MAX_READS; read += 1) {
    const outcome = Result.try((): unknown =>
      init(Reflect.get(node, "_payload"))
    );
    if (Result.isSuccess(outcome)) {
      return outcome.success;
    }
    const thrown = outcome.failure;
    if (!Predicate.isPromiseLike(thrown)) {
      return;
    }
    yield* Effect.promise(() =>
      Promise.resolve(thrown).then(
        () => undefined,
        () => undefined
      )
    );
  }
});

/** The faces that a formula's `MathFontPreload` declares in its props. */
function declaredFaces(props: unknown): readonly MathFont[] {
  return Predicate.hasProperty(props, "fonts") && Arr.isArray(props.fonts)
    ? Arr.filter(props.fonts, isMathFont)
    : [];
}

/**
 * The parts of an element that a render reads, its component and its props. A
 * client component arrives as a lazy node until its code loads, and a formula's
 * `MathFontPreload` adds the faces it declares to `faces`.
 */
const readElement = Effect.fn("www.static.readElement")(function* (
  element: object,
  faces: MutableHashSet.MutableHashSet<MathFont>
) {
  const declared = Reflect.get(element, "type");
  const type =
    Predicate.isObject(declared) && isLazyNode(declared)
      ? yield* readLazyNode(declared)
      : declared;
  const props = Reflect.get(element, "props");
  if (type === MathFontPreload) {
    for (const face of declaredFaces(props)) {
      MutableHashSet.add(faces, face);
    }
  }
  return [type, props];
});

/** The tree of a server component, or none for any other value or a tree still decoding. */
function treeOf(value: object) {
  const getTree = Reflect.get(value, TREE_GETTER);
  if (!Predicate.isFunction(getTree)) {
    return Result.failVoid;
  }
  // The getter suspends while the tree decodes, which outside a render throws.
  return Result.try((): unknown => getTree());
}

/**
 * Settles every server component in a loader's result before the route that
 * shows it commits. TanStack Start awaits the parts of a decoded tree that are
 * still arriving, but not the parts that arrived and wait to be parsed: React
 * parses those during the render that mounts the tree, and that render
 * suspends the tree's own new boundary, which draws nothing. A route that
 * mounts on a client navigation would show its body empty until the parsing
 * ends, then move everything under it. Reading each lazy node here does that
 * parsing while the previous page still shows, so the new page draws whole.
 * A component of the tree that renders a lazy component of its own exposes it
 * under `SETTLED_RENDERER`, and its code loads here too.
 *
 * The math faces that the tree's formulas declare (`MathFontPreload`) load here
 * as well. The server render preloads them for a page's first load only, so a
 * navigation from a page without math would draw each formula in a fallback
 * face and move the text around it when KaTeX's faces arrive.
 */
export const settleServerComponents = Effect.fn(
  "www.static.settleServerComponents"
)(function* (value: unknown, fonts: Pick<FontFaceSet, "load">) {
  // Parts of a tree are shared by reference, and an Effect hash set compares
  // objects by their fields, so the visited parts are kept by identity.
  const seen = new WeakSet<object>();
  const faces = MutableHashSet.empty<MathFont>();
  const pending = MutableList.make<unknown>();
  MutableList.append(pending, value);

  for (
    let next = MutableList.take(pending);
    next !== MutableList.Empty;
    next = MutableList.take(pending)
  ) {
    // A component reached through the tree may carry a lazy component of its own.
    if (Predicate.isFunction(next)) {
      MutableList.append(pending, Reflect.get(next, SETTLED_RENDERER));
      continue;
    }
    if (!Predicate.isObjectOrArray(next) || seen.has(next)) {
      continue;
    }
    seen.add(next);
    const tree = treeOf(next);
    if (Result.isSuccess(tree)) {
      MutableList.append(pending, tree.success);
      continue;
    }
    if (isLazyNode(next)) {
      MutableList.append(pending, yield* readLazyNode(next));
      continue;
    }
    if (isElement(next)) {
      MutableList.appendAll(pending, yield* readElement(next, faces));
      continue;
    }
    MutableList.appendAll(
      pending,
      Arr.isArray(next) ? next : Record.values(next)
    );
  }

  yield* loadMathFonts(fonts, Arr.fromIterable(faces)).pipe(
    Effect.timeoutOption(MATH_FONT_WAIT),
    // A face that fails to load is requested again when its formula first draws.
    Effect.catchTag("MathFontLoadError", () => Effect.void)
  );
});
