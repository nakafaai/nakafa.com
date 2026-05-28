import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
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

const classes_forums_mutations_forums_createForumImpl = FunctionImpl.make(
  api,
  "classes.forums.mutations.forums",
  "createForum",
  (args) =>
    schoolForumMutations_createForum(args).pipe(
      Effect.catchTags({
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
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
      }),
      Effect.orDie
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
        }),
        Effect.orDie
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
        }),
        Effect.orDie
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
      }),
      Effect.orDie
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
      }),
      Effect.orDie
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
      }),
      Effect.orDie
    )
);

const classes_forums_mutations_uploads_discardForumUploadsImpl =
  FunctionImpl.make(
    api,
    "classes.forums.mutations.uploads",
    "discardForumUploads",
    (args) =>
      schoolForumUploads_discardForumUploads(args).pipe(
        Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)),
        Effect.orDie
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
        }),
        Effect.orDie
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
      }),
      Effect.orDie
    )
);

const classes_forums_internalMutations_deleteExpiredPendingUploadImpl =
  FunctionImpl.make(
    api,
    "classes.forums.internalMutations",
    "deleteExpiredPendingUpload",
    (args) =>
      schoolForumUploads_deleteExpiredPendingUpload(args).pipe(Effect.orDie)
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
      }),
      Effect.orDie
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

export const classesForumsImpl = GroupImpl.make(api, "classes.forums")
  .pipe(Layer.provide(classesForumsInternalMutationsImpl))
  .pipe(Layer.provide(classesForumsMutationsImpl))
  .pipe(Layer.provide(classesForumsQueriesImpl));
