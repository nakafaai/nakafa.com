import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * Speech generation stays in the Node runtime for the larger memory budget
 * while buffering PCM/WAV output.
 *
 * @see https://docs.convex.dev/functions/runtimes#nodejs-runtime
 * @see https://confect.dev/server/node-actions
 */
const actionsGroup = GroupSpec.makeNode("actions").addFunction(
  FunctionSpec.internalNodeAction({
    name: "generateSpeech",
    args: Schema.Struct({
      contentAudioId: GenericId.GenericId("contentAudios"),
    }),
    returns: Schema.Null,
  })
);

/** Node action group for audio study generation workflows. */
export const audioStudiesNodeGroup =
  GroupSpec.makeNode("audioStudies").addGroup(actionsGroup);
