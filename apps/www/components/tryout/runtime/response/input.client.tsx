"use client";

import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields.client";
import { useTryoutResponseSubmit } from "@/components/tryout/runtime/response/submit.client";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";

interface TryoutResponseValue {
  locked: boolean;
  question: TryoutRuntimeQuestion;
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
        responseSpec: question.responseSpec,
        selection: question.response?.selection ?? null,
      }}
    />
  );
}
