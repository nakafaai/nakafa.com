import {
  LaurelWreath01Icon,
  LaurelWreathRight03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import {
  MODEL_IDS,
  type ModelId,
  ModelIdSchema,
  type ModelKey,
} from "@repo/ai/config/model";
import { Brand } from "effect";

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

const aiModelsById = {
  "nakafa-lite": {
    icon: modelIcons["nakafa-lite"],
    label: modelLabels["nakafa-lite"],
    subtitleKey: modelSubtitleKeys["nakafa-lite"],
    value: ModelIdSchema.make("nakafa-lite"),
  },
  "nakafa-pro": {
    icon: modelIcons["nakafa-pro"],
    label: modelLabels["nakafa-pro"],
    subtitleKey: modelSubtitleKeys["nakafa-pro"],
    value: ModelIdSchema.make("nakafa-pro"),
  },
} satisfies Record<
  ModelKey,
  {
    icon: IconSvgElement;
    label: (typeof modelLabels)[ModelKey];
    subtitleKey: (typeof modelSubtitleKeys)[ModelKey];
    value: ModelId;
  }
>;

export const aiModels = MODEL_IDS.map((value) => aiModelsById[value]);

/** Finds display metadata for one Nakafa model. */
export function getAiModel(modelId: ModelId) {
  return aiModelsById[Brand.unbranded(modelId)];
}
