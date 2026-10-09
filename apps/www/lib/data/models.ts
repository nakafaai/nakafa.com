import {
  LaurelWreath01Icon,
  LaurelWreathRight03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { ModelId, ModelKey } from "@repo/backend/confect/gateway/model";
import { Array as Arr, Record as Rec } from "effect";

const modelIcons = {
  "nakafa-lite": LaurelWreathRight03Icon,
  "nakafa-pro": LaurelWreath01Icon,
} satisfies Record<ModelKey, IconSvgElement>;

const modelLabels = {
  "nakafa-lite": "Lite",
  "nakafa-pro": "Pro",
} as const satisfies Record<ModelKey, string>;

const modelSubtitleKeys = {
  "nakafa-lite": "model-subtitle-nakafa-lite",
  "nakafa-pro": "model-subtitle-nakafa-pro",
} as const satisfies Record<ModelKey, string>;

/** Builds the display row of one model from its key. */
function aiModelRow(key: ModelKey) {
  return {
    icon: modelIcons[key],
    label: modelLabels[key],
    subtitleKey: modelSubtitleKeys[key],
    value: ModelId.make(key),
  };
}

/** Builds each row once, so `aiModels` and `getAiModel` return the same object. */
const aiModelsById = Rec.fromIterableWith(ModelKey.literals, (key) => [
  key,
  aiModelRow(key),
]);

export const aiModels = Arr.map(
  ModelKey.literals,
  (value) => aiModelsById[value]
);

/** Finds display metadata for one Nakafa model. */
export function getAiModel(model: ModelKey) {
  return aiModelsById[model];
}
