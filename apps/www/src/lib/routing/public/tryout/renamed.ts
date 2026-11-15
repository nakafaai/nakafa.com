import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { permanentRedirect } from "@/lib/routing/public/redirect";
import {
  decodeAppLocale,
  readActiveTryoutPath,
  readPathSegments,
  TRYOUT_ROOT,
} from "@/lib/routing/public/tryout/route";

/** One exam address that a locale retired, and the address that took its place. */
const RenamedExamSchema = Schema.Struct({
  appLocale: ActiveAppLocaleCodeSchema,
  from: Schema.String,
  to: Schema.String,
});

/**
 * The exam addresses retired on 9 Nov 2026, when every exam took its official
 * name in every locale (aksara#598). A slug spells its page's title, so the
 * Aufnahmeprüfung's English and Indonesian slugs followed its name.
 */
const RENAMED_EXAMS: readonly (typeof RenamedExamSchema.Type)[] = [
  {
    appLocale: "en",
    from: "try-out/germany/entrance-examination",
    to: "try-out/germany/aufnahmepruefung",
  },
  {
    appLocale: "id",
    from: "try-out/jerman/ujian-masuk",
    to: "try-out/jerman/aufnahmepruefung",
  },
];

/**
 * Answers a URL under a retired exam address with a permanent redirect to the
 * same page under the exam's address now, when the signed catalog serves it.
 */
export const readRenamedExamRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutRenamedExam"
)(function* (pathname: string) {
  const [localeSegment, root, country, exam, ...rest] =
    readPathSegments(pathname);
  const appLocale = decodeAppLocale(localeSegment);
  if (Option.isNone(appLocale) || root !== TRYOUT_ROOT) {
    return null;
  }
  const renamed = Arr.findFirst(
    RENAMED_EXAMS,
    (row) =>
      row.appLocale === appLocale.value &&
      row.from === `${TRYOUT_ROOT}/${country}/${exam}`
  );
  if (Option.isNone(renamed)) {
    return null;
  }
  const successor = Arr.join([renamed.value.to, ...rest], "/");
  const live = yield* readActiveTryoutPath(appLocale.value, successor);
  return live === null
    ? null
    : permanentRedirect(`/${appLocale.value}/${successor}`);
});
