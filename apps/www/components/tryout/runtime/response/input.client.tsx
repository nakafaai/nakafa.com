"use client";

import {
  type TryoutResponseFieldLabel,
  TryoutResponseFields,
} from "@/components/tryout/runtime/response/fields.client";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label.client";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit.client";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutResponseValue {
  locked: boolean;
  question: TryoutRuntimeQuestion;
}

function renderResponseLabel({
  correctness,
  id,
  label,
}: TryoutResponseFieldLabel) {
  return (
    <TryoutResponseLabel correctness={correctness} id={id}>
      {label}
    </TryoutResponseLabel>
  );
}

/** Connects the shared response fields to the persisted attempt mutation. */
export function TryoutResponse({ value }: { value: TryoutResponseValue }) {
  const submit = useTryoutResponseSubmit();
  const { locked, question } = value;

  return (
    <TryoutResponseFields
      value={{
        id: question.placementId,
        locked,
        onChange: (selection) => submit(question, selection),
        renderLabel: renderResponseLabel,
        responseSpec: question.responseSpec,
        selection: question.response?.selection ?? null,
      }}
    />
  );
}
