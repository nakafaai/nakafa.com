import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Id } from "@repo/backend/confect/_generated/id";
import { TryoutQuestionBodySchema } from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema } from "effect";
import type { TryoutBody } from "@/components/tryout/content/body";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

const placementId = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"));

/** A document of one paragraph that holds `text`. */
const paragraph = (text: string) => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** Builds one unanswered question of a running section. */
export function makeTryoutQuestion(
  name: string,
  change: Partial<TryoutRuntimeQuestion> = {}
): TryoutRuntimeQuestion {
  return {
    flagged: false,
    placementId: placementId(name),
    questionOrder: 1,
    response: null,
    ...change,
  };
}

/**
 * Builds the body of the question `makeTryoutQuestion(name)` places: a prompt and a choice that takes
 * one of two options, `first` and `second`, decoded as a page decodes a body.
 */
export function makeTryoutBody(name: string): TryoutBody {
  return {
    ...Schema.decodeSync(TryoutQuestionBodySchema)({
      interaction: {
        id: "choice",
        kind: "choice",
        label: "Answer",
        maxChoices: 1,
        minChoices: 1,
        options: [
          { id: "first", label: paragraph("First") },
          { id: "second", label: paragraph("Second") },
        ],
        shuffle: false,
      },
      prompt: paragraph(`Prompt of ${name}`),
    }),
    placementId: placementId(name),
    versionHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  };
}
