import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as school_class_mutations from "@repo/backend/confect/modules/school/classes/mutations.service";
import * as school_class_queries from "@repo/backend/confect/modules/school/classes/queries.service";
import * as school_materials from "@repo/backend/confect/modules/school/classMaterials.service";
import * as school_forum_mutations from "@repo/backend/confect/modules/school/forums/mutations.service";
import * as school_forum_queries from "@repo/backend/confect/modules/school/forums/queries.service";
import * as school_forum_uploads from "@repo/backend/confect/modules/school/forums/uploads.service";
import { Effect, Layer } from "effect";

const classes_materials_mutations_createMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "createMaterialGroup",
  (args) =>
    school_materials.createMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_materials_mutations_deleteMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "deleteMaterialGroup",
  (args) =>
    school_materials.deleteMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_materials_mutations_publishMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "publishMaterialGroup",
  (args) => school_materials.publishMaterialGroup(args)
);

const classes_materials_mutations_reorderMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "reorderMaterialGroup",
  (args) =>
    school_materials.reorderMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_materials_mutations_updateMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "updateMaterialGroup",
  (args) =>
    school_materials.updateMaterialGroup(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_mutations_createClassImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "createClass",
  (args) =>
    school_class_mutations.createClass(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_mutations_joinClassImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "joinClass",
  (args) =>
    school_class_mutations.joinClass(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_mutations_joinPublicClassImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "joinPublicClass",
  (args) =>
    school_class_mutations.joinPublicClass(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_mutations_updateClassImageImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "updateClassImage",
  (args) =>
    school_class_mutations.updateClassImage(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_mutations_updateClassVisibilityImpl = FunctionImpl.make(
  api,
  "classes.mutations",
  "updateClassVisibility",
  (args) =>
    school_class_mutations.updateClassVisibility(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_queries_getClassesImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getClasses",
  (args) =>
    school_class_queries.getClasses(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_queries_getClassRouteImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getClassRoute",
  (args) =>
    school_class_queries.getClassRoute(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_queries_getPeopleImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getPeople",
  (args) =>
    school_class_queries.getPeople(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_queries_getInviteCodesImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getInviteCodes",
  (args) =>
    school_class_queries.getInviteCodes(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_materials_queries_getMaterialGroupsImpl = FunctionImpl.make(
  api,
  "classes.materials.queries",
  "getMaterialGroups",
  (args) =>
    school_materials.getMaterialGroups(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_mutations_forums_createForumImpl = FunctionImpl.make(
  api,
  "classes.forums.mutations.forums",
  "createForum",
  (args) =>
    school_forum_mutations.createForum(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_mutations_posts_createForumPostImpl = FunctionImpl.make(
  api,
  "classes.forums.mutations.posts",
  "createForumPost",
  (args) =>
    school_forum_mutations.createForumPost(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_mutations_reactions_toggleForumReactionImpl =
  FunctionImpl.make(
    api,
    "classes.forums.mutations.reactions",
    "toggleForumReaction",
    (args) =>
      school_forum_mutations.toggleForumReaction(args).pipe(
        Effect.catchTags({
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
      )
  );

const classes_forums_mutations_reactions_togglePostReactionImpl =
  FunctionImpl.make(
    api,
    "classes.forums.mutations.reactions",
    "togglePostReaction",
    (args) =>
      school_forum_mutations.togglePostReaction(args).pipe(
        Effect.catchTags({
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
      )
  );

const classes_forums_queries_forums_getForumsImpl = FunctionImpl.make(
  api,
  "classes.forums.queries.forums",
  "getForums",
  (args) =>
    school_forum_queries.getForums(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_queries_forums_getForumImpl = FunctionImpl.make(
  api,
  "classes.forums.queries.forums",
  "getForum",
  (args) =>
    school_forum_queries.getForum(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_mutations_readState_markForumReadImpl = FunctionImpl.make(
  api,
  "classes.forums.mutations.readState",
  "markForumRead",
  (args) =>
    school_forum_mutations.markForumRead(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_mutations_uploads_discardForumUploadsImpl =
  FunctionImpl.make(
    api,
    "classes.forums.mutations.uploads",
    "discardForumUploads",
    (args) =>
      school_forum_uploads
        .discardForumUploads(args)
        .pipe(Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)))
  );

const classes_forums_mutations_uploads_generateUploadUrlImpl =
  FunctionImpl.make(
    api,
    "classes.forums.mutations.uploads",
    "generateUploadUrl",
    (args) =>
      school_forum_uploads.generateUploadUrl(args).pipe(
        Effect.catchTags({
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
      )
  );

const classes_forums_mutations_uploads_saveForumUploadImpl = FunctionImpl.make(
  api,
  "classes.forums.mutations.uploads",
  "saveForumUpload",
  (args) =>
    school_forum_uploads.saveForumUpload(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classes_forums_internalMutations_deleteExpiredPendingUploadImpl =
  FunctionImpl.make(
    api,
    "classes.forums.internalMutations",
    "deleteExpiredPendingUpload",
    (args) => school_forum_uploads.deleteExpiredPendingUpload(args)
  );

const classes_forums_queries_pages_getForumPostsImpl = FunctionImpl.make(
  api,
  "classes.forums.queries.pages",
  "getForumPosts",
  (args) =>
    school_forum_queries.getForumPosts(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const classesForumsMutationsForumsImpl = GroupImpl.make(
  api,
  "classes.forums.mutations.forums"
).pipe(Layer.provide(classes_forums_mutations_forums_createForumImpl));

const classesForumsMutationsPostsImpl = GroupImpl.make(
  api,
  "classes.forums.mutations.posts"
).pipe(Layer.provide(classes_forums_mutations_posts_createForumPostImpl));

const classesForumsMutationsReactionsImpl = GroupImpl.make(
  api,
  "classes.forums.mutations.reactions"
)
  .pipe(
    Layer.provide(classes_forums_mutations_reactions_toggleForumReactionImpl)
  )
  .pipe(
    Layer.provide(classes_forums_mutations_reactions_togglePostReactionImpl)
  );

const classesForumsMutationsReadStateImpl = GroupImpl.make(
  api,
  "classes.forums.mutations.readState"
).pipe(Layer.provide(classes_forums_mutations_readState_markForumReadImpl));

const classesForumsMutationsUploadsImpl = GroupImpl.make(
  api,
  "classes.forums.mutations.uploads"
)
  .pipe(Layer.provide(classes_forums_mutations_uploads_discardForumUploadsImpl))
  .pipe(Layer.provide(classes_forums_mutations_uploads_generateUploadUrlImpl))
  .pipe(Layer.provide(classes_forums_mutations_uploads_saveForumUploadImpl));

const classesForumsQueriesForumsImpl = GroupImpl.make(
  api,
  "classes.forums.queries.forums"
)
  .pipe(Layer.provide(classes_forums_queries_forums_getForumsImpl))
  .pipe(Layer.provide(classes_forums_queries_forums_getForumImpl));

const classesForumsQueriesPagesImpl = GroupImpl.make(
  api,
  "classes.forums.queries.pages"
).pipe(Layer.provide(classes_forums_queries_pages_getForumPostsImpl));

const classesForumsInternalMutationsImpl = GroupImpl.make(
  api,
  "classes.forums.internalMutations"
).pipe(
  Layer.provide(classes_forums_internalMutations_deleteExpiredPendingUploadImpl)
);

const classesForumsMutationsImpl = GroupImpl.make(
  api,
  "classes.forums.mutations"
)
  .pipe(Layer.provide(classesForumsMutationsForumsImpl))
  .pipe(Layer.provide(classesForumsMutationsPostsImpl))
  .pipe(Layer.provide(classesForumsMutationsReactionsImpl))
  .pipe(Layer.provide(classesForumsMutationsReadStateImpl))
  .pipe(Layer.provide(classesForumsMutationsUploadsImpl));

const classesForumsQueriesImpl = GroupImpl.make(api, "classes.forums.queries")
  .pipe(Layer.provide(classesForumsQueriesForumsImpl))
  .pipe(Layer.provide(classesForumsQueriesPagesImpl));

const classesMaterialsMutationsImpl = GroupImpl.make(
  api,
  "classes.materials.mutations"
)
  .pipe(Layer.provide(classes_materials_mutations_createMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_deleteMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_publishMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_reorderMaterialGroupImpl))
  .pipe(Layer.provide(classes_materials_mutations_updateMaterialGroupImpl));

const classesMaterialsQueriesImpl = GroupImpl.make(
  api,
  "classes.materials.queries"
).pipe(Layer.provide(classes_materials_queries_getMaterialGroupsImpl));

const classesForumsImpl = GroupImpl.make(api, "classes.forums")
  .pipe(Layer.provide(classesForumsInternalMutationsImpl))
  .pipe(Layer.provide(classesForumsMutationsImpl))
  .pipe(Layer.provide(classesForumsQueriesImpl));

const classesMaterialsImpl = GroupImpl.make(api, "classes.materials")
  .pipe(Layer.provide(classesMaterialsMutationsImpl))
  .pipe(Layer.provide(classesMaterialsQueriesImpl));

const classesMutationsImpl = GroupImpl.make(api, "classes.mutations")
  .pipe(Layer.provide(classes_mutations_createClassImpl))
  .pipe(Layer.provide(classes_mutations_joinClassImpl))
  .pipe(Layer.provide(classes_mutations_joinPublicClassImpl))
  .pipe(Layer.provide(classes_mutations_updateClassImageImpl))
  .pipe(Layer.provide(classes_mutations_updateClassVisibilityImpl));

const classesQueriesImpl = GroupImpl.make(api, "classes.queries")
  .pipe(Layer.provide(classes_queries_getClassesImpl))
  .pipe(Layer.provide(classes_queries_getClassRouteImpl))
  .pipe(Layer.provide(classes_queries_getPeopleImpl))
  .pipe(Layer.provide(classes_queries_getInviteCodesImpl));

const classesImpl = GroupImpl.make(api, "classes")
  .pipe(Layer.provide(classesForumsImpl))
  .pipe(Layer.provide(classesMaterialsImpl))
  .pipe(Layer.provide(classesMutationsImpl))
  .pipe(Layer.provide(classesQueriesImpl));

export const classesLayer = Layer.mergeAll(classesImpl);
