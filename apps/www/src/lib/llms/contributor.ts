import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr, Effect, Predicate } from "effect";
import { createTranslator, type Locale } from "use-intl/core";
import { contributors } from "@/lib/data/contributor";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";

/** Identifies the application-owned contributors document. */
export function isContributorLlmsRoute(cleanSlug: string) {
  return cleanSlug === "contributor";
}

/**
 * Renders the localized contributors page as agent-readable Markdown: the page's title and sentence, then one line
 * for each person with their role and the profiles they share, in the order the page shows them.
 */
export const getContributorLlmsText = Effect.fn("www.llms.contributor.text")(
  function* (locale: Locale) {
    const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
    const page = createTranslator({
      locale,
      messages,
      namespace: "Contributor",
    });
    const common = createTranslator({ locale, messages, namespace: "Common" });

    return Arr.join(
      [
        ...buildHeader({
          description: page("description"),
          title: `${page("title")} - ${COMPANY_IDENTITY.brandName}`,
          url: `${BASE_URL}/${locale}/contributor`,
        }),
        `## ${page("title")}`,
        Arr.join(
          Arr.map(contributors, ({ name, social, type }) => {
            const person = `- ${name}, ${common(type)}`;
            const profiles = Arr.filter(
              [social?.github, social?.linkedin, social?.twitter],
              Predicate.isNotUndefined
            );
            return Arr.isReadonlyArrayNonEmpty(profiles)
              ? `${person}: ${Arr.join(profiles, ", ")}`
              : person;
          }),
          "\n"
        ),
      ],
      "\n\n"
    );
  }
);
