import { FunctionImpl, GroupImpl } from "@confect/server";
import nodeApi from "@repo/backend/confect/_generated/nodeApi";
import { generateSpeech } from "@repo/backend/confect/modules/content/audioSpeech.actions";
import { Effect, Layer } from "effect";

/** Implements speech generation for queued audio studies. */
const generateSpeechImpl = FunctionImpl.make(
  nodeApi,
  "audioStudies.actions",
  "generateSpeech",
  (args) => generateSpeech(args).pipe(Effect.orDie)
);

/** Nested node action implementation layer for audio generation jobs. */
const actionsLayer = GroupImpl.make(nodeApi, "audioStudies.actions").pipe(
  Layer.provide(generateSpeechImpl)
);

/** Node action implementation layer for audio study generation workflows. */
export const audioStudiesNodeLayer = GroupImpl.make(
  nodeApi,
  "audioStudies"
).pipe(Layer.provide(actionsLayer));
