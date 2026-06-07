import type { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { decodeNakafaAgentMarkdown } from "@repo/contents/_lib/agent/read/markdown";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";
import {
  getRuntimeArticlePage,
  getRuntimeSubjectPage,
} from "@/lib/content/runtime";

/** Reads article or subject markdown from the Convex runtime model. */
export function readMdxMarkdown(ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const page = yield* getMdxRuntimePage(ref);

    if (!page) {
      return Option.none();
    }

    const markdown = yield* decodeNakafaAgentMarkdown({
      ...ref,
      description: getPageDescription(page),
      text: [`# ${page.metadata.title}`, "", page.body.trim()].join("\n"),
      title: page.metadata.title,
    });

    return Option.some(markdown);
  });
}

type RuntimeArticlePage = Effect.Effect.Success<
  ReturnType<typeof getRuntimeArticlePage>
>;
type RuntimeSubjectPage = Effect.Effect.Success<
  ReturnType<typeof getRuntimeSubjectPage>
>;
type MdxRuntimePage = RuntimeArticlePage | RuntimeSubjectPage;
type PublishedMdxRuntimePage = NonNullable<MdxRuntimePage>;

/** Loads one article or subject page from Convex for agent read/verify. */
export function getMdxRuntimePage(
  ref: NakafaAgentContentRef
): Effect.Effect<MdxRuntimePage, NakafaAgentDataReadError> {
  if (ref.section === "articles") {
    return getRuntimeArticlePage({
      locale: ref.locale,
      slug: ref.route,
    });
  }

  if (ref.section === "subject") {
    return getRuntimeSubjectPage({
      locale: ref.locale,
      slug: ref.route,
    });
  }

  return Effect.succeed(null);
}

/** Returns a page description with subject fallback for subject lessons. */
function getPageDescription(page: PublishedMdxRuntimePage) {
  if (page.metadata.description) {
    return page.metadata.description;
  }

  if ("subject" in page.metadata) {
    return page.metadata.subject ?? "";
  }

  return "";
}
