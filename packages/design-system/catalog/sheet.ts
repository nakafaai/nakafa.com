import { Array as Arr } from "effect";
import type { Root } from "postcss";

/** What the generated stylesheet scans for classes: the library, its helpers, and the catalog's own cards. */
const SOURCES = ["components", "lib", "catalog"];

/**
 * What the theme blocks keep: the base radius every rounded class computes from, which the tokens file lists only
 * as its computed steps, and the color scheme of form controls and scrollbars.
 */
const KEPT = ["--radius", "color-scheme"];

/**
 * Turns the app's global stylesheet into the design system page's stylesheet, in place. The page writes the theme
 * tokens itself from the tokens file and marks the dark theme on `<html data-theme="dark">`, so the theme blocks keep
 * only what the tokens file does not hold, the dark variant follows the page's attribute, and the classes come from the library alone. Inter takes its plain
 * Google Fonts name first, and Geist Mono the name of the font the tokens file lists.
 */
export function catalogSheet(root: Root, styles: string) {
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
  root.walkDecls("--font-sans", (declaration) => {
    declaration.value = declaration.value.replace(
      '"Inter Variable"',
      '"Inter", "Inter Variable"'
    );
  });
  root.append(':root { --font-geist-mono: "Geist Mono"; }');
  return root.toString();
}
