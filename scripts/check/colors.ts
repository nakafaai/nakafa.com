import { Array as Arr } from "effect";
import {
  isNumericLiteral,
  isStringLiteralLikeNode,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateTail,
  type Node,
  type SourceFile,
} from "tsrs/ast";
import { TEST_PATTERN } from "#scripts/check/kinds";
import { descendants } from "#scripts/check/source";

/** The folders that draw lesson visuals, whose every color is a plot or a neutral one. */
const VISUAL_DIRECTORIES = [
  "apps/www/src/lib/content/renderer/client/",
  "packages/design-system/components/contents/",
  "packages/design-system/components/three/",
  "packages/design-system/components/visual/",
];
/**
 * A color written in place: a hex value, a CSS color function, a Tailwind color
 * class, or a theme chart token, whose hue each of the 29 themes chooses on its
 * own, even when a template fills in its number.
 */
const COLOR_TEXT =
  /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(|chart-(?:[1-5]\b|$)|\b[a-z]+-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[1-9]0{1,2}\b/iu;
/** A color written as a six-digit hex number, the way three.js accepts one. */
const COLOR_NUMBER = /^0x[0-9a-f]{6}$/iu;
const COLOR_RULE =
  "color a plotted mark with PLOT_COLORS from @repo/design-system/lib/plot and a neutral surface with getColor from @repo/design-system/lib/color, instead of a color written in place or a theme chart token";

/**
 * Reports a color that a lesson visual writes in place. The plot palette keeps
 * every plotted hue away from the red, green, and blue axes, and the theme
 * chart tokens change with each theme, so a visual takes its colors from the
 * palette and the neutral scale alone. Tests are not judged.
 */
export function inspectColorSource(file: string, sourceFile: SourceFile) {
  if (
    TEST_PATTERN.test(file) ||
    !Arr.some(VISUAL_DIRECTORIES, (directory) => file.startsWith(directory))
  ) {
    return [];
  }
  return Arr.flatMap(descendants(sourceFile, false), (node) =>
    (writesText(node) && COLOR_TEXT.test(node.text)) ||
    (isNumericLiteral(node) && COLOR_NUMBER.test(node.getText(sourceFile)))
      ? [`${file}: ${COLOR_RULE}.`]
      : []
  );
}

/** Whether a node holds written text: a string, or a part of a template between its holes. */
function writesText(node: Node): node is Node & { readonly text: string } {
  return (
    isStringLiteralLikeNode(node) ||
    isTemplateHead(node) ||
    isTemplateMiddle(node) ||
    isTemplateTail(node)
  );
}
