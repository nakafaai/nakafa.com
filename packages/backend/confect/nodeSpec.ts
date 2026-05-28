import { FunctionSpec, GenericId, GroupSpec, Spec } from "@confect/core";
import { authNodeGroup } from "@repo/backend/confect/modules/identity/auth/auth.spec";
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

export default Spec.makeNode().add(authNodeGroup).add(audioStudiesGroup);
