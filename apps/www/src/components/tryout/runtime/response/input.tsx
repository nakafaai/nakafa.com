import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
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
        response: question.response?.response ?? null,
      }}
    />
  );
}
