import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const triggersCommentsCleanupGroup = GroupSpec.make("cleanup").addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedComment",
    args: Schema.Struct({ commentId: GenericId.GenericId("comments") }),
    returns: Schema.Null,
  })
);

export { triggersCommentsCleanupGroup };

const triggersCommentsGroup = GroupSpec.make("comments").addGroup(
  triggersCommentsCleanupGroup
);

export { triggersCommentsGroup };

const triggersMaterialsCleanupGroup = GroupSpec.make("cleanup")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedGroup",
      args: Schema.Struct({
        classId: GenericId.GenericId("schoolClasses"),
        groupId: GenericId.GenericId("schoolClassMaterialGroups"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedMaterial",
      args: Schema.Struct({
        materialId: GenericId.GenericId("schoolClassMaterials"),
      }),
      returns: Schema.Null,
    })
  );

export { triggersMaterialsCleanupGroup };

const triggersMaterialsGroup = GroupSpec.make("materials").addGroup(
  triggersMaterialsCleanupGroup
);

export { triggersMaterialsGroup };

const triggersChatsCleanupGroup = GroupSpec.make("cleanup").addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedChat",
    args: Schema.Struct({ chatId: GenericId.GenericId("chats") }),
    returns: Schema.Null,
  })
);

export { triggersChatsCleanupGroup };

const triggersChatsGroup = GroupSpec.make("chats").addGroup(
  triggersChatsCleanupGroup
);

export { triggersChatsGroup };

const triggersSchoolsCleanupGroup = GroupSpec.make("cleanup")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedClass",
      args: Schema.Struct({ classId: GenericId.GenericId("schoolClasses") }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedForum",
      args: Schema.Struct({
        forumId: GenericId.GenericId("schoolClassForums"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedForumPost",
      args: Schema.Struct({
        postId: GenericId.GenericId("schoolClassForumPosts"),
      }),
      returns: Schema.Null,
    })
  );

export { triggersSchoolsCleanupGroup };

const triggersSchoolsGroup = GroupSpec.make("schools").addGroup(
  triggersSchoolsCleanupGroup
);

export { triggersSchoolsGroup };

const triggersGroup = GroupSpec.make("triggers")
  .addGroup(triggersCommentsGroup)
  .addGroup(triggersMaterialsGroup)
  .addGroup(triggersChatsGroup)
  .addGroup(triggersSchoolsGroup);

export { triggersGroup };
