import { Array as Arr } from "effect";

/**
 * The page loads React as classic scripts, so a script built after them reads React from its globals: each module
 * resolves to a small CommonJS module that hands over the global, which serves `import` and `require` alike.
 */
export const GLOBALS = {
  react: "window.React",
  "react/jsx-runtime": "window.ReactJSX",
  "react-dom": "window.ReactDOM",
  "react-dom/client": "window.ReactDOM",
};

/** The file name of the module that hands over one global. */
export const shimName = (module: string) =>
  `global-${module.replaceAll("/", "-")}.cjs`;

/** Turns a module name into an identifier a generated import may bind. */
const binding = (index: number) => `card${index}`;

/**
 * The bundle's entry: every `components/ui` module, the card previews, the context a design wraps them in, and the
 * stylesheet. It is generated on each run from the folders, so a new module or card needs no list kept by hand.
 */
export function entryModule(
  modules: readonly string[],
  cards: readonly string[],
  root: string
) {
  return Arr.join(
    [
      `import "./catalog.css";`,
      `import { catalog } from "${root}/catalog/page";`,
      ...Arr.map(
        modules,
        (module) => `export * from "${root}/components/ui/${module}";`
      ),
      ...Arr.map(
        cards,
        (card, index) =>
          `import * as ${binding(index)} from "${root}/catalog/cards/${card}";`
      ),
      `export { Root } from "${root}/catalog/page";`,
      `export { toast } from "sonner";`,
      `export const showcase = catalog([${Arr.join(
        Arr.map(cards, (_, index) => binding(index)),
        ", "
      )}]);`,
      "",
    ],
    "\n"
  );
}

/** The classic scripts that put React and React DOM on the page, since React 19 ships no browser build. */
export const LIBRARIES = {
  react: Arr.join(
    [
      `import * as React from "react";`,
      `import * as ReactJSX from "react/jsx-runtime";`,
      "Object.assign(window, { React, ReactJSX });",
      "",
    ],
    "\n"
  ),
  "react-dom": Arr.join(
    [
      `import * as DOM from "react-dom";`,
      `import * as Client from "react-dom/client";`,
      "Object.assign(window, { ReactDOM: { ...DOM, ...Client } });",
      "",
    ],
    "\n"
  ),
};
