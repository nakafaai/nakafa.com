import {
  NakafaAgentMarkdownSchema,
  NakafaAgentReadOptionsSchema,
} from "@repo/contents/_lib/agent/schema/read";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect, Option } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";

export const NakafaGetContentToolInputSchema = NakafaAgentReadOptionsSchema;
export const NakafaGetContentToolOutputSchema = NakafaAgentMarkdownSchema;

/** Builds a full-content tool result for one Nakafa content reference. */
export function getNakafaContentToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* decodeNakafaMcpToolInput(
      NakafaGetContentToolInputSchema,
      args,
      "Invalid Nakafa content read options."
    );
    const content = yield* Nakafa.read(input.content_ref).pipe(
      Effect.provide(Nakafa.Default)
    );

    return Option.match(content, {
      onNone: () =>
        toMcpToolError("Nakafa content was not found.", [
          "Call `nakafa_search_content` first and pass back the exact returned `content_id` as `content_ref`.",
          "Use a canonical Nakafa URL such as `https://nakafa.com/en/quran/1`.",
        ]),
      onSome: toMcpStructuredResult,
    });
  }).pipe(
    Effect.catchTags({
      NakafaAgentDataReadError: succeedMcpReadModelError,
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
