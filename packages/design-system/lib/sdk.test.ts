import { afterEach, describe, expect, it } from "@effect/vitest";
import { UI_SDK_HEAD_SCRIPT, UI_SDK_STYLES } from "@repo/design-system/lib/sdk";

/** The registry in which UI SDK keeps the popups its popover reset holds, per document. */
const RESETS = Symbol.for("ui-sdk.popover-reset@2");

/** What the head script recorded for this document's popover reset. */
function readReset() {
  const resets: unknown = Reflect.get(globalThis, RESETS);
  return resets instanceof WeakMap ? resets.get(document) : undefined;
}

/** Runs the head script in a browser whose `CSS` registers properties and answers one feature query. */
function runScript(webkit: boolean) {
  const registerProperty = vi.fn();
  vi.stubGlobal("CSS", {
    registerProperty,
    supports: (query: string) =>
      webkit && query === "-webkit-backdrop-filter:none",
  });
  new Function(UI_SDK_HEAD_SCRIPT)();
  return registerProperty.mock.calls.map(([definition]) => definition);
}

/** The text of UI SDK's popover reset, from the navigation menu's viewport to the hover card's backdrop. */
const POPOVER_RESET_TEXT =
  /^@layer ui-sdk \{ :where\(\[data-slot="navigation-menu-viewport"\]\[popover\], .+\[data-slot="hover-card-backdrop"\]\[popover\]\) \{ inset: auto; width: auto; height: auto; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; overflow: visible; color: inherit; background: none \} \}$/u;

/** What UI SDK registers for a positioned popup and for a sheet, the same in every engine. */
const POPUP_AND_SHEET = [
  { inherits: false, name: "--available-height", syntax: "*" },
  { inherits: false, name: "--available-width", syntax: "*" },
  ...["progress", "dim", "expand", "stack"].map((part) => ({
    inherits: false,
    initialValue: "0",
    name: `--drawer-${part}`,
    syntax: "<number>",
  })),
];

describe("UI SDK's document-wide styles before the first paint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, RESETS);
  });

  it("renders the hidden rule and the popover reset as UI SDK writes them", () => {
    expect(UI_SDK_STYLES.map(({ id }) => id)).toStrictEqual([
      "ui-sdk-hidden",
      "ui-sdk-popover-reset",
    ]);
    expect(UI_SDK_STYLES[0].css).toBe(
      '@layer ui-sdk { :where([data-slot][hidden]:not([hidden="until-found"])) { display: none !important } }'
    );
    expect(UI_SDK_STYLES[1].css).toMatch(POPOVER_RESET_TEXT);
  });

  it("records every popup of the reset as prepared, with the text the head renders", () => {
    runScript(false);
    const reset = readReset();

    expect(reset.css).toBe(UI_SDK_STYLES[1].css);
    expect(reset.selectors).toContain('[data-slot="dialog-content"]');
    expect(reset.selectors).toContain('[data-slot="drawer-backdrop"]');
    expect(reset.css).toContain(
      Array.from(
        reset.selectors as Set<string>,
        (selector) => `${selector}[popover]`
      ).join(", ")
    );
  });

  it("keeps a reset that UI SDK already holds for the document", () => {
    const held = { css: "held", selectors: new Set<string>() };
    Reflect.set(globalThis, RESETS, new WeakMap([[document, held]]));
    runScript(false);

    expect(readReset()).toBe(held);
  });

  it("registers a popup's room, a sheet's drag and a scroll area's overflow", () => {
    expect(runScript(false)).toStrictEqual([
      ...POPUP_AND_SHEET,
      ...["x-start", "x-end", "y-start", "y-end"].map((edge) => ({
        inherits: false,
        initialValue: "0px",
        name: `--scroll-area-overflow-${edge}`,
        syntax: "<length>",
      })),
    ]);
  });

  it("leaves a scroll area's overflow to UI SDK in WebKit", () => {
    expect(runScript(true)).toStrictEqual(POPUP_AND_SHEET);
  });

  it("keeps registering after a property that is already registered", () => {
    const registerProperty = vi.fn(() => {
      throw new DOMException("registered", "InvalidModificationError");
    });
    vi.stubGlobal("CSS", { registerProperty, supports: () => false });
    new Function(UI_SDK_HEAD_SCRIPT)();

    expect(registerProperty).toHaveBeenCalledTimes(10);
  });

  it("still records the reset in a browser that cannot register a property", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    new Function(UI_SDK_HEAD_SCRIPT)();

    expect(readReset().css).toBe(UI_SDK_STYLES[1].css);
  });
});
