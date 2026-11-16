import { Array as Arr, Result } from "effect";
import type { Root } from "postcss";

/** The colors a theme's row shows: its ground, its text, its brand ink and its hover fill. */
const SHOWN = ["background", "foreground", "primary", "accent"] as const;

/** One value a theme's block declares, or a dash where it declares none. */
function valueIn(
  declared: readonly (readonly [string, string])[],
  name: string
) {
  return Arr.join(
    Arr.filterMap(declared, ([prop, value]) =>
      prop === name ? Result.succeed(`\`${value}\``) : Result.failVoid
    ),
    " "
  );
}

/**
 * The brand book's Themes section, from the stylesheet of the themes a learner can pick: each theme by its class,
 * its appearance, and the colors that set it apart. The design system page offers the light and dark pair as its own
 * themes; the Themes card draws components in every named one.
 */
export function themesSection(themes: Root) {
  const rows = Arr.filterMap(themes.nodes, (node) => {
    if (node.type !== "rule" || !node.selector.startsWith(".")) {
      return Result.failVoid;
    }
    const declared = Arr.filterMap(node.nodes, (child) =>
      child.type === "decl"
        ? Result.succeed([child.prop, child.value] as const)
        : Result.failVoid
    );
    const cells = Arr.map(SHOWN, (name) => valueIn(declared, `--${name}`));
    return Result.succeed(
      `| \`${node.selector.slice(1)}\` | ${valueIn(declared, "color-scheme").replaceAll("`", "")} | ${Arr.join(cells, " | ")} |`
    );
  });
  return Arr.join(
    [
      "# Themes",
      "",
      `A learner picks one of ${rows.length} named themes, beside the light and dark pair this system shows as its own. Each theme sets every token again under its class, so a component reads the same token names in all of them; the Themes card draws them side by side.`,
      "",
      `| Theme | Appearance | ${Arr.join(SHOWN, " | ")} |`,
      `| --- | --- | ${Arr.join(
        Arr.map(SHOWN, () => "---"),
        " | "
      )} |`,
      ...rows,
      "",
    ],
    "\n"
  );
}
