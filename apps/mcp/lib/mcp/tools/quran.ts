import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/_lib/agent/constants";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect, Option } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";

export const NakafaGetQuranReferenceToolInputSchema =
  NakafaAgentQuranReferenceOptionsSchema;
export const NakafaGetQuranReferenceToolOutputSchema =
  NakafaAgentQuranReferenceSchema;

/** Builds a Quran reference tool result after enforcing the MCP range limit. */
export function getNakafaQuranReferenceToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* decodeNakafaMcpToolInput(
      NakafaGetQuranReferenceToolInputSchema,
      args,
      "Invalid Nakafa Quran reference options."
    );
    const lastVerse = input.to_verse ?? input.from_verse;
    const requestedVerseCount = lastVerse - input.from_verse + 1;

    if (lastVerse < input.from_verse) {
      return toMcpToolError("Invalid Quran verse range.", [
        "`to_verse` must be greater than or equal to `from_verse`.",
      ]);
    }

    if (requestedVerseCount > NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES) {
      return toMcpToolError("Quran reference range is too large.", [
        `Request at most ${NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES} verses at a time.`,
        "Use `nakafa_get_content` with `https://nakafa.com/en/quran/{surah}` when you need a full surah.",
      ]);
    }

    const reference = yield* Nakafa.quran(input).pipe(
      Effect.provide(Nakafa.Default)
    );

    return Option.match(reference, {
      onNone: () =>
        toMcpToolError("Nakafa Quran reference was not found.", [
          "Check that the surah number is between 1 and 114.",
          "Check that the requested verse numbers exist in the selected surah.",
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
