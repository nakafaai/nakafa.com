import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  listIntegrityArticleReferencesPage as contentSyncQueries_listIntegrityArticleReferencesPage,
  listIntegrityArticlesPage as contentSyncQueries_listIntegrityArticlesPage,
  listIntegrityContentAuthorsPage as contentSyncQueries_listIntegrityContentAuthorsPage,
  listIntegrityExerciseChoicesPage as contentSyncQueries_listIntegrityExerciseChoicesPage,
  listIntegrityExerciseQuestionsPage as contentSyncQueries_listIntegrityExerciseQuestionsPage,
  listIntegritySubjectSectionsPage as contentSyncQueries_listIntegritySubjectSectionsPage,
} from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Effect, Layer } from "effect";

const contentSync_queries_integrity_listIntegrityExerciseQuestionsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityExerciseQuestionsPage",
    (args) =>
      contentSyncQueries_listIntegrityExerciseQuestionsPage(args).pipe(
        Effect.orDie
      )
  );

const contentSync_queries_integrity_listIntegrityExerciseChoicesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityExerciseChoicesPage",
    (args) =>
      contentSyncQueries_listIntegrityExerciseChoicesPage(args).pipe(
        Effect.orDie
      )
  );

const contentSync_queries_integrity_listIntegrityContentAuthorsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityContentAuthorsPage",
    (args) =>
      contentSyncQueries_listIntegrityContentAuthorsPage(args).pipe(
        Effect.orDie
      )
  );

const contentSync_queries_integrity_listIntegrityArticleReferencesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityArticleReferencesPage",
    (args) =>
      contentSyncQueries_listIntegrityArticleReferencesPage(args).pipe(
        Effect.orDie
      )
  );

const contentSync_queries_integrity_listIntegrityArticlesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityArticlesPage",
    (args) =>
      contentSyncQueries_listIntegrityArticlesPage(args).pipe(Effect.orDie)
  );

const contentSync_queries_integrity_listIntegritySubjectSectionsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegritySubjectSectionsPage",
    (args) =>
      contentSyncQueries_listIntegritySubjectSectionsPage(args).pipe(
        Effect.orDie
      )
  );

const contentSyncQueriesIntegrityImpl = GroupImpl.make(
  api,
  "contentSync.queries.integrity"
)
  .pipe(
    Layer.provide(
      contentSync_queries_integrity_listIntegrityExerciseQuestionsPageImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_queries_integrity_listIntegrityExerciseChoicesPageImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_queries_integrity_listIntegrityContentAuthorsPageImpl
    )
  )
  .pipe(
    Layer.provide(
      contentSync_queries_integrity_listIntegrityArticleReferencesPageImpl
    )
  )
  .pipe(
    Layer.provide(contentSync_queries_integrity_listIntegrityArticlesPageImpl)
  )
  .pipe(
    Layer.provide(
      contentSync_queries_integrity_listIntegritySubjectSectionsPageImpl
    )
  );

export { contentSyncQueriesIntegrityImpl };
