import { ASSESSMENT_RULES } from "@repo/backend/confect/editor/model";
import { blockDirections } from "@repo/design-system/components/editor/direction";
import { FORMULA_VIEWS } from "@repo/design-system/components/editor/formula";
import { PICTURE_VIEW } from "@repo/design-system/components/editor/picture";
import { documentExtensions } from "@repo/editor/document";

/**
 * The extensions every rich text of an exam shares: the assessment document of the contract, with
 * the pictures and the formulas it draws, as the player draws them, and the direction of each block
 * from its own words, so a text that mixes scripts reads right in both languages.
 */
export const RICH_EXTENSIONS = [
  ...documentExtensions(ASSESSMENT_RULES, {
    ...FORMULA_VIEWS,
    image: PICTURE_VIEW,
  }),
  blockDirections,
];
