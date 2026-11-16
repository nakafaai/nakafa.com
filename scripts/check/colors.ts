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

/** The folders of application chrome: every page and every component a learner sees. */
const CHROME_DIRECTORIES = [
  "apps/www/src/",
  "packages/design-system/components/",
];
/**
 * Where a color is another owner's and no theme may change it: the logo of another company, a
 * country's flag, and the dark and light modules of a QR code, which a scanner reads.
 */
const OWNED_PAINT_SCOPES = [
  "packages/design-system/components/logos/",
  "apps/www/src/components/shared/flag.tsx",
  "apps/www/src/components/shared/qr/",
];
/**
 * Where a color is the island's world art and no theme may change it: the block game's renderer
 * paints every face and sprite from one palette of named ramps, its sky and its seasons, and the
 * shader tints them for night, dusk and rain (docs/adr/0047-game.md, D4). The game's buttons and
 * panels around the canvas are chrome and take identity tokens as everywhere else.
 */
const WORLD_PAINT_SCOPES = ["apps/www/src/lib/island/"];
/**
 * Where white and black are no colors but the luminance of an SVG or CSS mask, which says how much
 * of a painted mark shows: the chart paints and the line overlay of the player. Any other color
 * written there is judged as everywhere else.
 */
const MASK_SCOPES = [
  "packages/design-system/components/evilcharts/",
  "apps/www/src/components/player/lines/overlay.tsx",
];
/** White or black as a mask's luminance. */
const MASK_LUMINANCE = /\b(?:white|black)\b/giu;
/**
 * An attribute selector that names the paint a library draws by default, such as Recharts' grid
 * stroke, so a class can restyle it: it selects, it paints nothing.
 */
const PAINT_SELECTOR = /\[[a-z-]+=['"]#[0-9a-f]{3,8}['"]\]/giu;
/**
 * A color written into chrome: a hex value (a number of four digits is an issue's, not a color), a
 * CSS color function over numbers, a Tailwind palette class, white or black as a class, as a whole
 * paint value, or inside a gradient.
 */
const CHROME_COLOR_TEXT =
  /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|(?!\d{4}(?![0-9a-z]))[0-9a-f]{3,4})(?![0-9a-z])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]|\b[a-z]+-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[1-9]\d{1,2}\b|(?<![\w-])(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|divide|caret|accent|placeholder)-(?:white|black)(?![\w-])|^(?:white|black)$|gradient\([^)]*\b(?:white|black)\b/iu;
const CHROME_RULE =
  "paint chrome with the theme's tokens, such as bg-background, text-foreground and bg-primary, or with an identity token of packages/design-system/styles/identity.css for a ground or an ink that every theme shares, instead of a color written in place";

/**
 * Reports a color written into application chrome. Nakafa has many themes and each one chooses its
 * own colors, so a page or a component that writes one in place looks the same in all of them. A
 * lesson visual is judged by `inspectColorSource`, another owner's paint and the island's world art
 * are left alone, and a mask may say white and black. Tests are not judged.
 */
export function inspectChromeColorSource(file: string, sourceFile: SourceFile) {
  if (
    TEST_PATTERN.test(file) ||
    !Arr.some(CHROME_DIRECTORIES, (directory) => file.startsWith(directory)) ||
    Arr.some(VISUAL_DIRECTORIES, (directory) => file.startsWith(directory)) ||
    Arr.some(OWNED_PAINT_SCOPES, (scope) => file.startsWith(scope)) ||
    Arr.some(WORLD_PAINT_SCOPES, (scope) => file.startsWith(scope))
  ) {
    return [];
  }
  const masks = Arr.some(MASK_SCOPES, (scope) => file.startsWith(scope));
  return Arr.flatMap(descendants(sourceFile, false), (node) => {
    if (!writesText(node)) {
      return [];
    }
    const selected = node.text.replace(PAINT_SELECTOR, "");
    const text = masks ? selected.replace(MASK_LUMINANCE, "") : selected;
    return CHROME_COLOR_TEXT.test(text) ? [`${file}: ${CHROME_RULE}.`] : [];
  });
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
