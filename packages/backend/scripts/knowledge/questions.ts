import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { biology } from "@repo/backend/scripts/knowledge/questions/biology";
import { chemistry } from "@repo/backend/scripts/knowledge/questions/chemistry";
import { computing } from "@repo/backend/scripts/knowledge/questions/computing";
import { mathematics } from "@repo/backend/scripts/knowledge/questions/mathematics";
import { physics } from "@repo/backend/scripts/knowledge/questions/physics";
import { quran } from "@repo/backend/scripts/knowledge/questions/quran";
import { Array as Arr } from "effect";

/**
 * Questions a learner asks, each labeled with the section that answers it: the
 * identity of its document, its place among the sections of the document, and
 * its heading in each language. The model test checks the heading against the
 * stored section before it counts a question, so a lesson that was edited since
 * the labels were written leaves its questions out, with the reason, and does
 * not bias the result.
 *
 * Most questions use other words than the heading of their section, so that
 * finding the section takes meaning and not only matching words.
 */
const intents = [
  ...physics,
  ...chemistry,
  ...biology,
  ...mathematics,
  ...computing,
  ...quran,
];

/** The questions of one language, each with the section it is labeled with. */
export function questionsFor(locale: ActiveAppLocaleCode) {
  return Arr.map(intents, (intent) => ({
    contentKey: intent.contentKey,
    heading: intent.heading[locale],
    ordinal: intent.ordinal,
    question: intent.question[locale],
  }));
}
