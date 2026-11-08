import { SelectLabel } from "@repo/design-system/components/ui/select";
import { Schema } from "effect";
import { useTranslations } from "use-intl";

/** What a school select chooses, each named by one word. */
const ChoiceName = Schema.Literals([
  "audience",
  "class",
  "client",
  "cohort",
  "credits",
  "curve",
  "exam",
  "grade",
  "kind",
  "language",
  "length",
  "level",
  "mark",
  "passage",
  "period",
  "person",
  "role",
  "scope",
  "scoring",
  "tolerance",
  "unit",
  "zone",
]);

/**
 * The one-word label a select's list opens with, naming what is chosen, such as "Kelas", so a list never reads as bare
 * codes such as "1A". It stands first in the list's `SelectGroup`, above options that each show the icon of their kind.
 */
export function ChoiceLabel({ name }: { name: typeof ChoiceName.Type }) {
  const common = useTranslations("Common");

  return <SelectLabel>{common(`menu-${name}`)}</SelectLabel>;
}
