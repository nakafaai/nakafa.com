import type { PlayerResponses } from "@/components/player/response";
import {
  CategoryFields,
  MultipleChoiceFields,
  SingleChoiceFields,
} from "@/components/tryout/runtime/response/fields.client";
import {
  pickMultipleChoice,
  pickSingleChoice,
} from "@/components/tryout/runtime/response/pick";

/** The try-out renderer of every response kind; a new kind must be added here. */
export const tryoutResponses = {
  category: { Fields: CategoryFields },
  "multiple-choice": { Fields: MultipleChoiceFields, pick: pickMultipleChoice },
  "single-choice": { Fields: SingleChoiceFields, pick: pickSingleChoice },
} satisfies PlayerResponses;
