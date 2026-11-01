import { Array as Arr, String as Str } from "effect";
import {
  isStringLiteralLikeNode,
  type SourceFile,
} from "typescript/unstable/ast";
import { descendants, namesModule } from "#scripts/check/source";

/** The settings card, which only the Settings components import. */
const SECTION_MODULE = "@/components/shared/card/section";
/** The folders of the two Settings areas, a school's and an account's. */
const SETTINGS_FOLDERS = [
  "apps/www/src/components/tenant/settings/",
  "apps/www/src/components/user/settings/",
];
const SECTION_RULE = `${SECTION_MODULE} is the settings card, which only Settings draws: use a plain heading, body and footer here`;

/**
 * Reports the settings card outside Settings. A card with a title, a sentence and an action
 * strip reads as a setting, so a screen of any other kind that draws one misleads its reader.
 * Modules of the two Settings areas pass, and the rule reads the import, so a re-export or a
 * dynamic import of the card is refused too.
 */
export function inspectSectionSource(file: string, sourceFile: SourceFile) {
  if (Arr.some(SETTINGS_FOLDERS, (folder) => Str.startsWith(folder)(file))) {
    return [];
  }
  return Arr.map(
    Arr.flatMap(descendants(sourceFile, false), (node) =>
      isStringLiteralLikeNode(node) &&
      node.text === SECTION_MODULE &&
      namesModule(node)
        ? [SECTION_RULE]
        : []
    ),
    (rule) => `${file}: ${rule}.`
  );
}
