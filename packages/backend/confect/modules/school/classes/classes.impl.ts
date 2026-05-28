import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  createClass as schoolClassMutations_createClass,
  joinClass as schoolClassMutations_joinClass,
  joinPublicClass as schoolClassMutations_joinPublicClass,
  updateClassImage as schoolClassMutations_updateClassImage,
  updateClassVisibility as schoolClassMutations_updateClassVisibility,
} from "@repo/backend/confect/modules/school/classes/mutations.service";
import {
  getClasses as schoolClassQueries_getClasses,
  getClassRoute as schoolClassQueries_getClassRoute,
  getInviteCodes as schoolClassQueries_getInviteCodes,
  getPeople as schoolClassQueries_getPeople,
} from "@repo/backend/confect/modules/school/classes/queries.service";
import {
  createMaterialGroup as schoolMaterials_createMaterialGroup,
  deleteMaterialGroup as schoolMaterials_deleteMaterialGroup,
  getMaterialGroups as schoolMaterials_getMaterialGroups,
  publishMaterialGroup as schoolMaterials_publishMaterialGroup,
  reorderMaterialGroup as schoolMaterials_reorderMaterialGroup,
  updateMaterialGroup as schoolMaterials_updateMaterialGroup,
} from "@repo/backend/confect/modules/school/classMaterials.service";
import {
  createForum as schoolForumMutations_createForum,
  createForumPost as schoolForumMutations_createForumPost,
  markForumRead as schoolForumMutations_markForumRead,
  toggleForumReaction as schoolForumMutations_toggleForumReaction,
  togglePostReaction as schoolForumMutations_togglePostReaction,
} from "@repo/backend/confect/modules/school/forums/mutations.service";
import {
  getForum as schoolForumQueries_getForum,
  getForumPosts as schoolForumQueries_getForumPosts,
  getForums as schoolForumQueries_getForums,
} from "@repo/backend/confect/modules/school/forums/queries.service";
import {
  deleteExpiredPendingUpload as schoolForumUploads_deleteExpiredPendingUpload,
  discardForumUploads as schoolForumUploads_discardForumUploads,
  generateUploadUrl as schoolForumUploads_generateUploadUrl,
  saveForumUpload as schoolForumUploads_saveForumUpload,
} from "@repo/backend/confect/modules/school/forums/uploads.service";
import { Effect, Layer } from "effect";

const classes_materials_mutations_createMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "createMaterialGroup",
  (args) =>
    schoolMaterials_createMaterialGroup(args).pipe(
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
    schoolMaterials_deleteMaterialGroup(args).pipe(
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
  (args) => schoolMaterials_publishMaterialGroup(args)
);

const classes_materials_mutations_reorderMaterialGroupImpl = FunctionImpl.make(
  api,
  "classes.materials.mutations",
  "reorderMaterialGroup",
  (args) =>
    schoolMaterials_reorderMaterialGroup(args).pipe(
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
    schoolMaterials_updateMaterialGroup(args).pipe(
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
    schoolClassMutations_createClass(args).pipe(
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
    schoolClassMutations_joinClass(args).pipe(
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
    schoolClassMutations_joinPublicClass(args).pipe(
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
    schoolClassMutations_updateClassImage(args).pipe(
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
    schoolClassMutations_updateClassVisibility(args).pipe(
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
    schoolClassQueries_getClasses(args).pipe(
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
    schoolClassQueries_getClassRoute(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error))
    )
);

const classes_queries_getPeopleImpl = FunctionImpl.make(
  api,
  "classes.queries",
  "getPeople",
  (args) =>
    schoolClassQueries_getPeople(args).pipe(
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
    schoolClassQueries_getInviteCodes(args).pipe(
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
    schoolMaterials_getMaterialGroups(args).pipe(
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
    schoolForumMutations_createForum(args).pipe(
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
    schoolForumMutations_createForumPost(args).pipe(
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
      schoolForumMutations_toggleForumReaction(args).pipe(
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
      schoolForumMutations_togglePostReaction(args).pipe(
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
    schoolForumQueries_getForums(args).pipe(
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
    schoolForumQueries_getForum(args).pipe(
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
    schoolForumMutations_markForumRead(args).pipe(
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
      schoolForumUploads_discardForumUploads(args).pipe(
        Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error))
      )
  );

const classes_forums_mutations_uploads_generateUploadUrlImpl =
  FunctionImpl.make(
    api,
    "classes.forums.mutations.uploads",
    "generateUploadUrl",
    (args) =>
      schoolForumUploads_generateUploadUrl(args).pipe(
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
    schoolForumUploads_saveForumUpload(args).pipe(
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
    (args) => schoolForumUploads_deleteExpiredPendingUpload(args)
  );

const classes_forums_queries_pages_getForumPostsImpl = FunctionImpl.make(
  api,
  "classes.forums.queries.pages",
  "getForumPosts",
  (args) =>
    schoolForumQueries_getForumPosts(args).pipe(
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
