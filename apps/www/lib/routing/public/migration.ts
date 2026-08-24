import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const PREVIOUS_SUBJECT_NAMESPACE = "subject";
const REDIRECTABLE_METHODS = new Set(["GET", "HEAD"]);

/** Resolves the German article URLs exposed before localized routes shipped. */
function readPreviousArticleRedirect(pathname: string) {
  switch (pathname) {
    case "/de/articles/politics":
      return "/de/articles/politik";
    case "/de/articles/politics/regional-elections-turmoil":
      return "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen";
    case "/de/articles/politics/pork-barrel-politics-power":
      return "/de/articles/politik/sozialhilfe-und-wahlpolitische-anreize";
    case "/de/articles/politics/nepotism-in-political-governance":
      return "/de/articles/politik/nepotismus-und-politische-verantwortung";
    case "/de/articles/politics/merah-putih-cabinet-analysis":
      return "/de/articles/politik/kabinett-merah-putih-und-koalitionspolitik";
    case "/de/articles/politics/kim-plus-empty-box":
      return "/de/articles/politik/kim-plus-und-das-leere-feld";
    case "/de/articles/politics/flawed-legal-geopolitics":
      return "/de/articles/politik/nusantara-rechtsgrundlage-und-sicherheit";
    case "/de/articles/politics/dynastic-politics-asian-values":
      return "/de/articles/politik/politische-dynastien-und-asiatische-werte";
    default:
      return null;
  }
}

/** Resolves one retired public URL to its exact current successor. */
export const readPublicUrlMigrationRedirect = Effect.fn(
  "www.routing.publicHtml.urlMigrationRedirect"
)(function* ({ method, pathname }: { method: string; pathname: string }) {
  if (!REDIRECTABLE_METHODS.has(method)) {
    return null;
  }

  const articleRedirect = readPreviousArticleRedirect(pathname);
  if (articleRedirect) {
    return articleRedirect;
  }

  const identity = readPreviousMaterialIdentity(pathname);
  if (Option.isNone(identity)) {
    return null;
  }

  const redirect = yield* readRuntimeQuery(
    api.contentRelease.material.identity,
    identity.value
  );
  if (!(redirect.activeReleaseId && redirect.managed && redirect.publicPath)) {
    return null;
  }

  return `/${identity.value.appLocale}/${redirect.publicPath}`;
});

/** Decodes one exact retired subject lesson URL into its stable content key. */
function readPreviousMaterialIdentity(pathname: string) {
  const [
    locale,
    namespace,
    category,
    grade,
    domain,
    topic,
    section,
    ...extraSegments
  ] = pathname.split("/").filter(Boolean);

  if (
    !(
      namespace === PREVIOUS_SUBJECT_NAMESPACE &&
      category &&
      grade &&
      domain &&
      topic &&
      section &&
      extraSegments.length === 0 &&
      hasLocale(routing.locales, locale)
    )
  ) {
    return Option.none();
  }

  const contentKey = Schema.decodeOption(ContentKeySchema)(
    `material/lesson/${domain}/${topic}/${section}`
  );
  if (Option.isNone(contentKey)) {
    return Option.none();
  }

  return Option.some({
    appLocale: locale,
    contentKey: contentKey.value,
    expectedMaterialKey: `lesson.${domain}.${topic}`,
    expectedSectionKey: section,
  });
}
