import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  listIntegrityArticleReferencesPage,
  listIntegrityArticlesPage,
  listIntegrityContentAuthorsPage,
  listIntegrityExerciseChoicesPage,
  listIntegrityExerciseQuestionsPage,
  listIntegritySubjectSectionsPage,
} from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Effect, Layer } from "effect";

const contentSync_queries_integrity_listIntegrityExerciseQuestionsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityExerciseQuestionsPage",
    (args) => listIntegrityExerciseQuestionsPage(args).pipe(Effect.orDie)
  );

const contentSync_queries_integrity_listIntegrityExerciseChoicesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityExerciseChoicesPage",
    (args) => listIntegrityExerciseChoicesPage(args).pipe(Effect.orDie)
  );

const contentSync_queries_integrity_listIntegrityContentAuthorsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityContentAuthorsPage",
    (args) => listIntegrityContentAuthorsPage(args).pipe(Effect.orDie)
  );

const contentSync_queries_integrity_listIntegrityArticleReferencesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityArticleReferencesPage",
    (args) => listIntegrityArticleReferencesPage(args).pipe(Effect.orDie)
  );

const contentSync_queries_integrity_listIntegrityArticlesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityArticlesPage",
    (args) => listIntegrityArticlesPage(args).pipe(Effect.orDie)
  );

const contentSync_queries_integrity_listIntegritySubjectSectionsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegritySubjectSectionsPage",
    (args) => listIntegritySubjectSectionsPage(args).pipe(Effect.orDie)
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
