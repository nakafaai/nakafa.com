import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { TryoutQuestionBody as Body } from "@repo/backend/confect/tryouts/runtime/spec";
import { useState } from "react";
import { TryoutQuestionBody } from "@/components/tryout/runtime/question/body";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import {
  makePartsWriter,
  onlyResponse,
} from "@/components/tryout/runtime/response/parts";
import { placeTryoutParts } from "@/components/tryout/runtime/response/place";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutResponseProps {
  value: {
    /** The question's one interaction, from its body. */
    interaction: Interaction;
    locked: boolean;
    question: TryoutRuntimeQuestion;
  };
}

/** Connects the shared response fields to the persisted attempt mutation. */
export function TryoutResponse({ value }: TryoutResponseProps) {
  const submit = useTryoutResponseSubmit();
  const { interaction, locked, question } = value;

  return (
    <TryoutResponseFields
      value={{
        id: question.placementId,
        interaction,
        locked,
        onChange: (response) => submit(question, response),
        response: onlyResponse(question.response?.response ?? null),
      }}
    />
  );
}

/**
 * The body of a question of several parts with the field of each part where its prompt puts it, each saved to the
 * persisted attempt as the question's one response (`makePartsWriter`). The page's own last write numbers the next,
 * so two parts that save in the same moment both reach the server.
 */
export function TryoutPartsBody({
  body,
  locked,
  question,
}: {
  readonly body: Pick<Body, "interactions" | "prompt" | "stimulus">;
  readonly locked: boolean;
  readonly question: TryoutRuntimeQuestion;
}) {
  const submit = useTryoutResponseSubmit();
  const [writePart] = useState(makePartsWriter);

  return (
    <TryoutQuestionBody
      body={body}
      place={placeTryoutParts({
        id: question.placementId,
        interactions: body.interactions,
        locked,
        onPart: (interaction, response) => {
          const write = writePart(question, interaction, response);
          submit(question, write.response, write.version);
        },
        response: question.response?.response ?? null,
      })}
    />
  );
}
