import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutResponseProps {
  value: {
    locked: boolean;
    question: TryoutRuntimeQuestion;
  };
}

/** Connects the shared response fields to the persisted attempt mutation. */
export function TryoutResponse({ value }: TryoutResponseProps) {
  const submit = useTryoutResponseSubmit();
  const { locked, question } = value;

  return (
    <TryoutResponseFields
      value={{
        id: question.placementId,
        locked,
        onChange: (selection) => submit(question, selection),
        renderLabel: ({ correctness, id, label }) => (
          <TryoutResponseLabel correctness={correctness} id={id}>
            {label}
          </TryoutResponseLabel>
        ),
        responseSpec: question.responseSpec,
        selection: question.response?.selection ?? null,
      }}
    />
  );
}
