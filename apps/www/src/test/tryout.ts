import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { TryoutQuestionBodySchema } from "@repo/backend/confect/tryouts/runtime/spec";
import { Array as Arr, Schema } from "effect";
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
 * Builds the body of the question `makeTryoutQuestion(name)` places, in each of `languages` (Indonesian
 * unless given): a prompt and a choice that takes one of two options, `first` and `second`, each with
 * the language in its words, decoded as a page decodes a body.
 */
export function makeTryoutBody(
  name: string,
  languages: Arr.NonEmptyReadonlyArray<string> = ["id"]
): TryoutBody {
  return {
    placementId: placementId(name),
    versions: Arr.map(languages, (language) => ({
      ...Schema.decodeSync(TryoutQuestionBodySchema)({
        interaction: {
          id: "choice",
          kind: "choice",
          label: "Answer",
          maxChoices: 1,
          minChoices: 1,
          options: [
            { id: "first", label: paragraph(`First ${language}`) },
            { id: "second", label: paragraph(`Second ${language}`) },
          ],
          shuffle: false,
        },
        prompt: paragraph(`Prompt of ${name} in ${language}`),
      }),
      hash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
      language: Schema.decodeSync(ContentLanguageSchema)(language),
    })),
  };
}
