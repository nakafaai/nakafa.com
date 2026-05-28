import { FunctionImpl, GroupImpl } from "@confect/server";
import nodeApi from "@repo/backend/confect/_generated/nodeApi";
import {
  generateScript,
  generateSpeech,
} from "@repo/backend/confect/modules/content/audioGeneration.actions";
import { Effect, Layer } from "effect";

const audioStudies_actions_generateSpeechImpl = FunctionImpl.make(
  nodeApi,
  "audioStudies.actions",
  "generateSpeech",
  (args) => generateSpeech(args).pipe(Effect.orDie)
);

const audioStudies_actions_generateScriptImpl = FunctionImpl.make(
  nodeApi,
  "audioStudies.actions",
  "generateScript",
  (args) => generateScript(args).pipe(Effect.orDie)
);

const audioStudiesActionsImpl = GroupImpl.make(
  nodeApi,
  "audioStudies.actions"
).pipe(
  Layer.provide(audioStudies_actions_generateSpeechImpl),
  Layer.provide(audioStudies_actions_generateScriptImpl)
);

const audioStudiesImpl = GroupImpl.make(nodeApi, "audioStudies").pipe(
  Layer.provide(audioStudiesActionsImpl)
);

export const generated = Layer.mergeAll(audioStudiesImpl);
