import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

const placementId = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"));

/** Builds one unanswered single-choice question of a running section, with two options. */
export function makeTryoutQuestion(
  name: string,
  change: Partial<TryoutRuntimeQuestion> = {}
): TryoutRuntimeQuestion {
  return {
    contentHash: `hash-${name}`,
    placementId: placementId(name),
    questionOrder: 1,
    response: null,
    responseSpec: {
      kind: "single-choice",
      options: [
        { label: "First", optionKey: "first", order: 1 },
        { label: "Second", optionKey: "second", order: 2 },
      ],
    },
    sourcePath: `${name}.mdx`,
    sourceRevision: "revision",
    ...change,
  };
}
