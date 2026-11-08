import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { blockDirections } from "@repo/design-system/components/editor/direction";
import { FIGURE_VIEW } from "@repo/design-system/components/editor/figure";
import { FORMULA_VIEWS } from "@repo/design-system/components/editor/formula";
import { objectKeys } from "@repo/design-system/components/editor/objects";
import { PICTURE_VIEW } from "@repo/design-system/components/editor/picture";
import { ARTICLE_MARKS } from "@repo/design-system/components/editor/prose";
import { wordPaste } from "@repo/design-system/components/editor/word";
import { documentExtensions } from "@repo/editor/document";

/**
 * The extensions every rich text of an exam shares: the assessment document of the contract, with
 * the pictures, the figures, the formulas and the marks it draws, as the player draws them, and the direction of each block
 * from its own words, so a text that mixes scripts reads right in both languages. A list pasted from
 * Word stays a list. The keys of a table, a picture and a formula come last, so they run before the
 * document's own keys and after the keys of a menu that a text adds, such as the slash menu.
 */
export const RICH_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES, {
    ...FORMULA_VIEWS,
    figure: FIGURE_VIEW,
    image: PICTURE_VIEW,
    marks: ARTICLE_MARKS,
  }),
  blockDirections,
  wordPaste,
  objectKeys,
];
