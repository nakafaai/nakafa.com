import { FunctionImpl, GroupImpl } from "@confect/server";
import { Layer } from "effect";
import nodeApi from "./_generated/nodeApi";
import * as audio_generation from "./modules/content/audioGeneration.actions";

const audioStudies_actions_generateSpeechImpl = FunctionImpl.make(
  nodeApi,
  "audioStudies.actions",
  "generateSpeech",
  (args) => audio_generation.generateSpeech(args)
);

const audioStudies_actions_generateScriptImpl = FunctionImpl.make(
  nodeApi,
  "audioStudies.actions",
  "generateScript",
  (args) => audio_generation.generateScript(args)
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
