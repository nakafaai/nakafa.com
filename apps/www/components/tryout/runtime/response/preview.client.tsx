"use client";

import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { useState } from "react";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields.client";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

/** Provides local-only selection state for the authenticated author preview. */
export function TryoutResponsePreview({
  id,
  responseSpec,
}: {
  readonly id: string;
  readonly responseSpec: QuestionResponse;
}) {
  const [selection, setSelection] = useState<TryoutResponseSelection | null>(
    null
  );
  return (
    <TryoutResponseFields
      value={{
        id,
        locked: false,
        onChange: setSelection,
        responseSpec,
        selection,
      }}
    />
  );
}
