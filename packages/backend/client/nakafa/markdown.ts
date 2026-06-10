import { decodeNakafaMarkdown } from "@repo/backend/client/nakafa/decode";
import { readExerciseMarkdown } from "@repo/backend/client/nakafa/exercise";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { readQuranMarkdown } from "@repo/backend/client/nakafa/quran";
import type { RuntimeMdxPage } from "@repo/backend/client/nakafa/types";
import { api } from "@repo/backend/convex/_generated/api";
import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

/** Reads full markdown for one normalized Nakafa content reference. */
export function readNakafaMarkdown(convexUrl: string, input: string) {
  return Effect.gen(function* () {
    const ref = parseNakafaContentRef(input);

    if (Option.isNone(ref)) {
      return Option.none<NakafaAgentMarkdown>();
    }

    if (ref.value.section === "quran") {
      return yield* readQuranMarkdown(convexUrl, ref.value);
    }

    if (ref.value.section === "exercises") {
      return yield* readExerciseMarkdown(convexUrl, ref.value);
    }

    return yield* readMdxMarkdown(convexUrl, ref.value);
  });
}

/** Reads article or subject markdown from Convex runtime rows. */
export function readMdxMarkdown(convexUrl: string, ref: NakafaAgentContentRef) {
  return Effect.gen(function* () {
    const page = yield* getMdxRuntimePage(convexUrl, ref);

    if (!page) {
      return Option.none<NakafaAgentMarkdown>();
    }

    const markdown = yield* decodeNakafaMarkdown({
      ...ref,
      description: getMdxDescription(page),
      text: [`# ${page.metadata.title}`, "", page.body.trim()].join("\n"),
      title: page.metadata.title,
    });

    return Option.some(markdown);
  });
}

/** Reads one article or subject page from the Convex runtime model. */
export function getMdxRuntimePage(
  convexUrl: string,
  ref: NakafaAgentContentRef
) {
  if (ref.section === "articles") {
    return fetchNakafaRuntimeQuery(
      convexUrl,
      "getArticlePage",
      api.contents.queries.runtime.getArticlePage,
      {
        locale: ref.locale,
        slug: ref.route,
      }
    );
  }

  if (ref.section === "subject") {
    return fetchNakafaRuntimeQuery(
      convexUrl,
      "getSubjectPage",
      api.contents.queries.runtime.getSubjectPage,
      {
        locale: ref.locale,
        slug: ref.route,
      }
    );
  }

  return Effect.succeed(null);
}

/** Returns the best agent-facing description for an MDX runtime page. */
function getMdxDescription(page: RuntimeMdxPage) {
  if (page.metadata.description) {
    return page.metadata.description;
  }

  if ("subject" in page.metadata) {
    return page.metadata.subject ?? "";
  }

  return "";
}
