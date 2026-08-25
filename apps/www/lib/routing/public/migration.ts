import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Option, Schema } from "effect";
import { hasPublishedArticleCategory } from "@/lib/content/article/category";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const PREVIOUS_SUBJECT_NAMESPACE = "subject";
const PREVIOUS_MATERIAL_LEVELS = new Set([
  "high-school/10",
  "high-school/11",
  "high-school/12",
  "university/bachelor",
]);
const REDIRECTABLE_METHODS = new Set(["GET", "HEAD"]);

interface ArticleCategoryMigration {
  readonly kind: "category";
  readonly previousRoute: string;
  readonly successorRoute: string;
}

interface ArticlePageMigration {
  readonly kind: "article";
  readonly previousPath: string;
  readonly successorPath: string;
}

type ArticleMigration = ArticleCategoryMigration | ArticlePageMigration;

/** Resolves the German article URLs exposed before localized routes shipped. */
function readPreviousArticleMigration(
  pathname: string
): ArticleMigration | null {
  switch (pathname) {
    case "/de/articles/politics":
      return {
        kind: "category",
        previousRoute: "politics",
        successorRoute: "politik",
      };
    case "/de/articles/politics/regional-elections-turmoil":
      return {
        kind: "article",
        previousPath: "articles/politics/regional-elections-turmoil",
        successorPath:
          "articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen",
      };
    case "/de/articles/politics/pork-barrel-politics-power":
      return {
        kind: "article",
        previousPath: "articles/politics/pork-barrel-politics-power",
        successorPath:
          "articles/politik/sozialhilfe-und-wahlpolitische-anreize",
      };
    case "/de/articles/politics/nepotism-in-political-governance":
      return {
        kind: "article",
        previousPath: "articles/politics/nepotism-in-political-governance",
        successorPath:
          "articles/politik/nepotismus-und-politische-verantwortung",
      };
    case "/de/articles/politics/merah-putih-cabinet-analysis":
      return {
        kind: "article",
        previousPath: "articles/politics/merah-putih-cabinet-analysis",
        successorPath:
          "articles/politik/kabinett-merah-putih-und-koalitionspolitik",
      };
    case "/de/articles/politics/kim-plus-empty-box":
      return {
        kind: "article",
        previousPath: "articles/politics/kim-plus-empty-box",
        successorPath: "articles/politik/kim-plus-und-das-leere-feld",
      };
    case "/de/articles/politics/flawed-legal-geopolitics":
      return {
        kind: "article",
        previousPath: "articles/politics/flawed-legal-geopolitics",
        successorPath:
          "articles/politik/nusantara-rechtsgrundlage-und-sicherheit",
      };
    case "/de/articles/politics/dynastic-politics-asian-values":
      return {
        kind: "article",
        previousPath: "articles/politics/dynastic-politics-asian-values",
        successorPath:
          "articles/politik/politische-dynastien-und-asiatische-werte",
      };
    default:
      return null;
  }
}

/** Redirects a category only after its prior route leaves the signed catalog. */
const readArticleCategoryRedirect = Effect.fn(
  "www.routing.publicHtml.articleCategoryMigration"
)(function* (migration: ArticleCategoryMigration) {
  const [previousExists, successorExists] = yield* Effect.all(
    [
      hasPublishedArticleCategory(migration.previousRoute, "de"),
      hasPublishedArticleCategory(migration.successorRoute, "de"),
    ],
    { concurrency: 2 }
  );

  if (previousExists || !successorExists) {
    return null;
  }

  return `/de/articles/${migration.successorRoute}`;
});

/** Redirects an article only when one active release owns the exact successor. */
const readArticlePageRedirect = Effect.fn(
  "www.routing.publicHtml.articlePageMigration"
)(function* (migration: ArticlePageMigration) {
  const identity = yield* readActiveContentIdentity();
  if (!identity) {
    return null;
  }

  const [previous, successor] = yield* Effect.all(
    [
      readActiveContentRoute({
        activeReleaseId: identity.releaseId,
        appLocale: "de",
        family: "article",
        publicPath: migration.previousPath,
      }),
      readActiveContentRoute({
        activeReleaseId: identity.releaseId,
        appLocale: "de",
        family: "article",
        publicPath: migration.successorPath,
      }),
    ],
    { concurrency: 2 }
  );

  if (previous.kind !== "missing" || successor.kind !== "found") {
    return null;
  }

  return `/de/${migration.successorPath}`;
});

/** Resolves a redirect only against the currently active signed route model. */
function readArticleMigrationRedirect(migration: ArticleMigration) {
  if (migration.kind === "category") {
    return readArticleCategoryRedirect(migration);
  }

  return readArticlePageRedirect(migration);
}

/** Resolves one retired public URL to its exact current successor. */
export const readPublicUrlMigrationRedirect = Effect.fn(
  "www.routing.publicHtml.urlMigrationRedirect"
)(function* ({ method, pathname }: { method: string; pathname: string }) {
  if (!REDIRECTABLE_METHODS.has(method)) {
    return null;
  }

  const articleMigration = readPreviousArticleMigration(pathname);
  if (articleMigration) {
    return yield* readArticleMigrationRedirect(articleMigration);
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
      isPreviousMaterialLocale(locale) &&
      isPreviousMaterialLevel(category, grade)
    )
  ) {
    return Option.none();
  }

  const currentTopic = readCurrentMaterialTopic({
    category,
    domain,
    grade,
    topic,
  });
  const contentKey = Schema.decodeOption(ContentKeySchema)(
    `material/lesson/${domain}/${currentTopic}/${section}`
  );
  if (Option.isNone(contentKey)) {
    return Option.none();
  }

  return Option.some({
    appLocale: locale,
    contentKey: contentKey.value,
    expectedMaterialKey: `lesson.${domain}.${currentTopic}`,
    expectedSectionKey: section,
  });
}

/** Accepts only locales that exposed the retired subject namespace. */
function isPreviousMaterialLocale(locale: string): locale is "en" | "id" {
  return locale === "en" || locale === "id";
}

/** Accepts only curriculum levels that exposed the retired subject routes. */
function isPreviousMaterialLevel(category: string, grade: string) {
  return PREVIOUS_MATERIAL_LEVELS.has(`${category}/${grade}`);
}

/** Resolves the two source-proven statistics topic splits. */
function readCurrentMaterialTopic({
  category,
  domain,
  grade,
  topic,
}: {
  readonly category: string;
  readonly domain: string;
  readonly grade: string;
  readonly topic: string;
}) {
  switch (`${category}/${grade}/${domain}/${topic}`) {
    case "high-school/10/mathematics/statistics":
      return "statistics-foundations";
    case "high-school/11/mathematics/statistics":
      return "statistics-regression";
    default:
      return topic;
  }
}
