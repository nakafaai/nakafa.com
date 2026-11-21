import { Array as Arr } from "effect";
import type { Root } from "postcss";

/** What the generated stylesheet scans for classes: the library, its helpers, and the catalog's own cards. */
const SOURCES = ["components", "lib", "catalog"];

/**
 * What the theme blocks keep: the base radius every rounded class computes from, which the tokens file lists only
 * as its computed steps, and the color scheme of form controls and scrollbars.
 */
const KEPT = ["--radius", "color-scheme"];

/** The import of Allo's faces, whose files the page serves from the tokens file's fonts instead. */
const FACES = '"./allo.css"';

/**
 * Turns the app's global stylesheet into the design system page's stylesheet, in place. The page writes the theme
 * tokens itself from the tokens file and marks the dark theme on `<html data-theme="dark">`, so the theme blocks keep
 * only what the tokens file does not hold, the dark variant follows the page's attribute, and the classes come from the library alone. The page
 * declares Allo and Geist Mono from the fonts the tokens file lists, so the sheet leaves out Allo's own faces and names
 * Geist Mono by that font. Every named theme's class comes along, so a card can show a component in each theme.
 */
export function catalogSheet(root: Root, styles: string, themes: string) {
  root.each((node) => {
    if (
      node.type === "rule" &&
      (node.selector === ":root" || node.selector === ".dark")
    ) {
      node.each((child) => {
        if (!(child.type === "decl" && Arr.contains(KEPT, child.prop))) {
          child.remove();
        }
      });
      node.selector =
        node.selector === ":root" ? ":root" : '[data-theme="dark"]';
      return;
    }
    if (node.type !== "atrule") {
      return;
    }
    if (node.name === "import" && node.params === FACES) {
      node.remove();
      return;
    }
    if (node.name === "import" && node.params.startsWith('"./')) {
      node.params = `"${styles}/${node.params.slice(3)}`;
    }
    if (node.name === "source") {
      node.replaceWith(
        Arr.map(SOURCES, (folder) =>
          node.clone({ params: `"${styles}/../${folder}"` })
        )
      );
    }
    if (node.name === "custom-variant" && node.params.startsWith("dark ")) {
      node.params = 'dark (&:is([data-theme="dark"] *))';
    }
  });
  root.prepend(`@import "${themes}";`);
  root.append(':root { --font-geist-mono: "Geist Mono"; }');
  return root.toString();
}
