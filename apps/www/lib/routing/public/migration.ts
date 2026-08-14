import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { api } from "@repo/backend/convex/_generated/api";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const PREVIOUS_SUBJECT_NAMESPACE = "subject";
const REDIRECTABLE_METHODS = new Set(["GET", "HEAD"]);

/** Resolves a retired material URL through the active signed publication. */
export const readPublicUrlMigrationRedirect = Effect.fn(
  "www.routing.publicHtml.urlMigrationRedirect"
)(function* ({ method, pathname }: { method: string; pathname: string }) {
  if (!REDIRECTABLE_METHODS.has(method)) {
    return null;
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

  return `/${identity.value.locale}/${redirect.publicPath}`;
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

  const contentKey = Schema.decodeUnknownOption(ContentKeySchema)(
    `material/lesson/${domain}/${topic}/${section}`
  );
  if (Option.isNone(contentKey)) {
    return Option.none();
  }

  return Option.some({
    contentKey: contentKey.value,
    expectedMaterialKey: `lesson.${domain}.${topic}`,
    expectedSectionKey: section,
    locale,
  });
}
