import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as chat_cleanup from "@repo/backend/confect/modules/chat/chatCleanup.service";
import * as content_comment_cleanup from "@repo/backend/confect/modules/content/commentCleanup.service";
import * as school_material_cleanup from "@repo/backend/confect/modules/school/materialCleanup.service";
import * as school_cleanup from "@repo/backend/confect/modules/school/schoolCleanup.service";
import { Layer } from "effect";

const triggers_comments_cleanup_cleanupDeletedCommentImpl = FunctionImpl.make(
  api,
  "triggers.comments.cleanup",
  "cleanupDeletedComment",
  (args) => content_comment_cleanup.cleanupDeletedComment(args)
);

const triggers_materials_cleanup_cleanupDeletedGroupImpl = FunctionImpl.make(
  api,
  "triggers.materials.cleanup",
  "cleanupDeletedGroup",
  (args) => school_material_cleanup.cleanupDeletedGroup(args)
);

const triggers_materials_cleanup_cleanupDeletedMaterialImpl = FunctionImpl.make(
  api,
  "triggers.materials.cleanup",
  "cleanupDeletedMaterial",
  (args) => school_material_cleanup.cleanupDeletedMaterial(args)
);

const triggers_chats_cleanup_cleanupDeletedChatImpl = FunctionImpl.make(
  api,
  "triggers.chats.cleanup",
  "cleanupDeletedChat",
  (args) => chat_cleanup.cleanupDeletedChat(args)
);

const triggers_schools_cleanup_cleanupDeletedClassImpl = FunctionImpl.make(
  api,
  "triggers.schools.cleanup",
  "cleanupDeletedClass",
  (args) => school_cleanup.cleanupDeletedClass(args)
);

const triggers_schools_cleanup_cleanupDeletedForumImpl = FunctionImpl.make(
  api,
  "triggers.schools.cleanup",
  "cleanupDeletedForum",
  (args) => school_cleanup.cleanupDeletedForum(args)
);

const triggers_schools_cleanup_cleanupDeletedForumPostImpl = FunctionImpl.make(
  api,
  "triggers.schools.cleanup",
  "cleanupDeletedForumPost",
  (args) => school_cleanup.cleanupDeletedForumPost(args)
);

const triggersChatsCleanupImpl = GroupImpl.make(
  api,
  "triggers.chats.cleanup"
).pipe(Layer.provide(triggers_chats_cleanup_cleanupDeletedChatImpl));

const triggersCommentsCleanupImpl = GroupImpl.make(
  api,
  "triggers.comments.cleanup"
).pipe(Layer.provide(triggers_comments_cleanup_cleanupDeletedCommentImpl));

const triggersMaterialsCleanupImpl = GroupImpl.make(
  api,
  "triggers.materials.cleanup"
)
  .pipe(Layer.provide(triggers_materials_cleanup_cleanupDeletedGroupImpl))
  .pipe(Layer.provide(triggers_materials_cleanup_cleanupDeletedMaterialImpl));

const triggersSchoolsCleanupImpl = GroupImpl.make(
  api,
  "triggers.schools.cleanup"
)
  .pipe(Layer.provide(triggers_schools_cleanup_cleanupDeletedClassImpl))
  .pipe(Layer.provide(triggers_schools_cleanup_cleanupDeletedForumImpl))
  .pipe(Layer.provide(triggers_schools_cleanup_cleanupDeletedForumPostImpl));

const triggersChatsImpl = GroupImpl.make(api, "triggers.chats").pipe(
  Layer.provide(triggersChatsCleanupImpl)
);

const triggersCommentsImpl = GroupImpl.make(api, "triggers.comments").pipe(
  Layer.provide(triggersCommentsCleanupImpl)
);

const triggersMaterialsImpl = GroupImpl.make(api, "triggers.materials").pipe(
  Layer.provide(triggersMaterialsCleanupImpl)
);

const triggersSchoolsImpl = GroupImpl.make(api, "triggers.schools").pipe(
  Layer.provide(triggersSchoolsCleanupImpl)
);

const triggersImpl = GroupImpl.make(api, "triggers")
  .pipe(Layer.provide(triggersChatsImpl))
  .pipe(Layer.provide(triggersCommentsImpl))
  .pipe(Layer.provide(triggersMaterialsImpl))
  .pipe(Layer.provide(triggersSchoolsImpl));

export const triggersLayer = Layer.mergeAll(triggersImpl);
