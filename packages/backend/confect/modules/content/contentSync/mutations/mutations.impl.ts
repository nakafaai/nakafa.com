import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { contentSyncMutationsArticlesImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/articles.impl";
import { contentSyncMutationsAuthorsImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/authors.impl";
import { contentSyncMutationsExercisesImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/exercises.impl";
import { contentSyncMutationsMaintenanceImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/maintenance.impl";
import { contentSyncMutationsSubjectsImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/subjects.impl";
import { contentSyncMutationsTryoutsImpl } from "@repo/backend/confect/modules/content/contentSync/mutations/tryouts.impl";
import { Layer } from "effect";

const contentSyncMutationsImpl = GroupImpl.make(api, "contentSync.mutations")
  .pipe(Layer.provide(contentSyncMutationsArticlesImpl))
  .pipe(Layer.provide(contentSyncMutationsAuthorsImpl))
  .pipe(Layer.provide(contentSyncMutationsExercisesImpl))
  .pipe(Layer.provide(contentSyncMutationsMaintenanceImpl))
  .pipe(Layer.provide(contentSyncMutationsSubjectsImpl))
  .pipe(Layer.provide(contentSyncMutationsTryoutsImpl));

export { contentSyncMutationsImpl };
