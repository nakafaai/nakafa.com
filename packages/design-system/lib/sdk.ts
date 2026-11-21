import { Array as Arr } from "effect";

/*
 * The document-wide styles and properties UI SDK writes at run time, given to the
 * page before its first style pass (vercel-labs/ui#1001).
 *
 * UI SDK writes them before the first paint, or at the first idle moment after it.
 * A server-rendered page hydrates after its first paint, so every write lands at
 * idle right after hydration, and each one restyles or lays out the whole page: a
 * registered property invalidates the root's style, and a new `@layer ui-sdk`
 * sheet re-collects the page's font faces and lays out every object. On a slow
 * phone that was three passes of about 100 ms each on the home page (ADR 0039
 * D17). The head renders each sheet with the text UI SDK would write and
 * registers each property first, so UI SDK's own writes find them in place and
 * change nothing.
 */

/** The sheet in which UI SDK hides a part that carries `hidden`, whatever its own `display`. */
const HIDDEN_STYLE = {
  css: '@layer ui-sdk { :where([data-slot][hidden]:not([hidden="until-found"])) { display: none !important } }',
  id: "ui-sdk-hidden",
};

/**
 * The parts UI SDK opens in the browser's top layer, each as the `data-slot` it
 * names in its popover reset: every popup family's content and backdrop, and the
 * navigation menu's viewport and content.
 */
const POPOVER_SLOTS = [
  "navigation-menu-viewport",
  "navigation-menu-content",
  ...Arr.flatMap(
    [
      "popover",
      "dialog",
      "alert-dialog",
      "drawer",
      "menu",
      "tooltip",
      "hover-card",
    ],
    (family) => [`${family}-content`, `${family}-backdrop`]
  ),
];

/** The selectors of UI SDK's popover reset, in the form UI SDK keeps them. */
const POPOVER_SELECTORS = Arr.map(
  POPOVER_SLOTS,
  (slot) => `[data-slot="${slot}"]`
);

/**
 * The sheet in which UI SDK clears the browser's own popover styles from its popups.
 * UI SDK builds its text from the popups that have prepared so far, so the head
 * writes it for every popup at once and records those popups as prepared.
 */
const POPOVER_RESET_STYLE = {
  css: `@layer ui-sdk { :where(${Arr.join(
    Arr.map(POPOVER_SELECTORS, (selector) => `${selector}[popover]`),
    ", "
  )}) { inset: auto; width: auto; height: auto; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; overflow: visible; color: inherit; background: none } }`,
  id: "ui-sdk-popover-reset",
};

/** The sheets UI SDK writes into every page, which the head renders as `<style>` elements. */
export const UI_SDK_STYLES = [HIDDEN_STYLE, POPOVER_RESET_STYLE] as const;

/**
 * Registers the properties UI SDK registers, and records every popup of the popover
 * reset as prepared in the registry UI SDK keeps for it, from the head of the page.
 * Here the document has no elements yet, so none of it restyles anything.
 *
 * - A positioned popup's room, which UI SDK registers to take any value without
 *   inheriting, and registers the same way here.
 * - A sheet's drag, which UI SDK registers as numbers from 0, as here.
 * - A scroll area's overflow, which UI SDK registers to take any value. Here they
 *   register as lengths from 0px, so a fade that reads one in `min()` before the
 *   first scroll draws nothing instead of failing. WebKit is left out for these,
 *   because `inherit` fails there on a property that does not inherit.
 */
export const UI_SDK_HEAD_SCRIPT = `(function () {
  var resets = (globalThis[Symbol.for("ui-sdk.popover-reset@2")] = globalThis[Symbol.for("ui-sdk.popover-reset@2")] || new WeakMap());
  if (!resets.has(document)) {
    resets.set(document, { selectors: new Set(${JSON.stringify(POPOVER_SELECTORS)}), css: ${JSON.stringify(POPOVER_RESET_STYLE.css)} });
  }
  if (typeof CSS === "undefined" || !CSS.registerProperty) {
    return;
  }
  function register(definition) {
    try {
      CSS.registerProperty(definition);
    } catch (error) {}
  }
  ["--available-height", "--available-width"].forEach(function (name) {
    register({ name: name, syntax: "*", inherits: false });
  });
  ["--drawer-progress", "--drawer-dim", "--drawer-expand", "--drawer-stack"].forEach(function (name) {
    register({ name: name, syntax: "<number>", inherits: false, initialValue: "0" });
  });
  if (CSS.supports("-webkit-backdrop-filter:none")) {
    return;
  }
  ["x-start", "x-end", "y-start", "y-end"].forEach(function (edge) {
    register({ name: "--scroll-area-overflow-" + edge, syntax: "<length>", inherits: false, initialValue: "0px" });
  });
})();`;
