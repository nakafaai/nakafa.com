import { FunctionSpec, GenericId, GroupSpec, Spec } from "@confect/core";
import { Schema } from "effect";

const audioStudiesActionsGroup = GroupSpec.makeNode("actions")
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "generateSpeech",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "generateScript",
      args: Schema.Struct({
        contentAudioId: GenericId.GenericId("contentAudios"),
      }),
      returns: Schema.Null,
    })
  );

export { audioStudiesActionsGroup };

const audioStudiesGroup = GroupSpec.makeNode("audioStudies").addGroup(
  audioStudiesActionsGroup
);

export { audioStudiesGroup };

export default Spec.makeNode().add(audioStudiesGroup);
