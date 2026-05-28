import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { cleanupDeletedChat } from "@repo/backend/confect/modules/chat/chatCleanup.service";
import { cleanupDeletedComment } from "@repo/backend/confect/modules/content/commentCleanup.service";
import {
  cleanupDeletedGroup,
  cleanupDeletedMaterial,
} from "@repo/backend/confect/modules/school/materialCleanup.service";
import {
  cleanupDeletedClass,
  cleanupDeletedForum,
  cleanupDeletedForumPost,
} from "@repo/backend/confect/modules/school/schoolCleanup.service";
import { Effect, Layer } from "effect";

const triggers_comments_cleanup_cleanupDeletedCommentImpl = FunctionImpl.make(
  api,
  "triggers.comments.cleanup",
  "cleanupDeletedComment",
  (args) => cleanupDeletedComment(args).pipe(Effect.orDie)
);
const triggers_materials_cleanup_cleanupDeletedGroupImpl = FunctionImpl.make(
  api,
  "triggers.materials.cleanup",
  "cleanupDeletedGroup",
  (args) => cleanupDeletedGroup(args).pipe(Effect.orDie)
);
const triggers_materials_cleanup_cleanupDeletedMaterialImpl = FunctionImpl.make(
  api,
  "triggers.materials.cleanup",
  "cleanupDeletedMaterial",
  (args) => cleanupDeletedMaterial(args).pipe(Effect.orDie)
);
const triggers_chats_cleanup_cleanupDeletedChatImpl = FunctionImpl.make(
  api,
  "triggers.chats.cleanup",
  "cleanupDeletedChat",
  (args) => cleanupDeletedChat(args).pipe(Effect.orDie)
);
const triggers_schools_cleanup_cleanupDeletedClassImpl = FunctionImpl.make(
  api,
  "triggers.schools.cleanup",
  "cleanupDeletedClass",
  (args) => cleanupDeletedClass(args).pipe(Effect.orDie)
);
const triggers_schools_cleanup_cleanupDeletedForumImpl = FunctionImpl.make(
  api,
  "triggers.schools.cleanup",
  "cleanupDeletedForum",
  (args) => cleanupDeletedForum(args).pipe(Effect.orDie)
);
const triggers_schools_cleanup_cleanupDeletedForumPostImpl = FunctionImpl.make(
  api,
  "triggers.schools.cleanup",
  "cleanupDeletedForumPost",
  (args) => cleanupDeletedForumPost(args).pipe(Effect.orDie)
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
