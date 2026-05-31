import {
  LaurelWreath01Icon,
  LaurelWreathRight03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { MODEL_IDS, type ModelId } from "@repo/ai/config/model";

const modelIcons = {
  "nakafa-lite": LaurelWreathRight03Icon,
  "nakafa-pro": LaurelWreath01Icon,
} satisfies Record<ModelId, IconSvgElement>;

const modelLabels = {
  "nakafa-lite": "Lite",
  "nakafa-pro": "Pro",
} as const satisfies Record<ModelId, string>;

const modelSubtitleKeys = {
  "nakafa-lite": "model-subtitle-nakafa-lite",
  "nakafa-pro": "model-subtitle-nakafa-pro",
} as const satisfies Record<ModelId, string>;

const aiModelsById = {
  "nakafa-lite": {
    icon: modelIcons["nakafa-lite"],
    label: modelLabels["nakafa-lite"],
    subtitleKey: modelSubtitleKeys["nakafa-lite"],
    value: "nakafa-lite",
  },
  "nakafa-pro": {
    icon: modelIcons["nakafa-pro"],
    label: modelLabels["nakafa-pro"],
    subtitleKey: modelSubtitleKeys["nakafa-pro"],
    value: "nakafa-pro",
  },
} satisfies Record<
  ModelId,
  {
    icon: IconSvgElement;
    label: (typeof modelLabels)[ModelId];
    subtitleKey: (typeof modelSubtitleKeys)[ModelId];
    value: ModelId;
  }
>;

export const aiModels = MODEL_IDS.map((value) => aiModelsById[value]);

/** Finds display metadata for one Nakafa model. */
export function getAiModel(modelId: ModelId) {
  return aiModelsById[modelId];
}
