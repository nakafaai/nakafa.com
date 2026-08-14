import type { ContentRuntimeTarget } from "@repo/backend/client/content/public";
import { readPublishedMarkdown } from "@repo/backend/client/nakafa/published";
import { readQuranMarkdown } from "@repo/backend/client/nakafa/quran";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { Effect, Option } from "effect";

type PublishedRef = NakafaAgentContentRef & {
  readonly section: "articles" | "material";
};

/** Reads full markdown for one normalized Nakafa content reference. */
export const readNakafaMarkdown = Effect.fn("NakafaContent.readMarkdown")(
  function* (
    convexUrl: string,
    readContentTarget: () => ContentRuntimeTarget,
    input: string
  ) {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);
    if (Option.isNone(ref)) {
      return Option.none<NakafaAgentMarkdown>();
    }
    if (ref.value.section === "quran") {
      return yield* readQuranMarkdown(convexUrl, ref.value);
    }
    if (isPublishedRef(ref.value)) {
      return yield* readPublishedMarkdown(readContentTarget, ref.value);
    }
    return Option.none<NakafaAgentMarkdown>();
  }
);

/** Narrows current signed MDX families without admitting try-out or Quran. */
function isPublishedRef(ref: NakafaAgentContentRef): ref is PublishedRef {
  return ref.section === "articles" || ref.section === "material";
}
