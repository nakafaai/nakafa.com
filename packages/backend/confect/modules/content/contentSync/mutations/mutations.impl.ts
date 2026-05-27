import { GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { Layer } from "effect";
import { contentSyncMutationsArticlesImpl } from "./articles.impl";
import { contentSyncMutationsAuthorsImpl } from "./authors.impl";
import { contentSyncMutationsExercisesImpl } from "./exercises.impl";
import { contentSyncMutationsMaintenanceImpl } from "./maintenance.impl";
import { contentSyncMutationsSubjectsImpl } from "./subjects.impl";
import { contentSyncMutationsTryoutsImpl } from "./tryouts.impl";

const contentSyncMutationsImpl = GroupImpl.make(api, "contentSync.mutations")
  .pipe(Layer.provide(contentSyncMutationsArticlesImpl))
  .pipe(Layer.provide(contentSyncMutationsAuthorsImpl))
  .pipe(Layer.provide(contentSyncMutationsExercisesImpl))
  .pipe(Layer.provide(contentSyncMutationsMaintenanceImpl))
  .pipe(Layer.provide(contentSyncMutationsSubjectsImpl))
  .pipe(Layer.provide(contentSyncMutationsTryoutsImpl));

export { contentSyncMutationsImpl };
