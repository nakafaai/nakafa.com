import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as content_sync_queries from "@repo/backend/confect/modules/content/contentSyncQueries.service";
import { Layer } from "effect";

const contentSync_queries_integrity_listIntegrityExerciseQuestionsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityExerciseQuestionsPage",
    (args) => content_sync_queries.listIntegrityExerciseQuestionsPage(args)
  );

const contentSync_queries_integrity_listIntegrityExerciseChoicesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityExerciseChoicesPage",
    (args) => content_sync_queries.listIntegrityExerciseChoicesPage(args)
  );

const contentSync_queries_integrity_listIntegrityContentAuthorsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityContentAuthorsPage",
    (args) => content_sync_queries.listIntegrityContentAuthorsPage(args)
  );

const contentSync_queries_integrity_listIntegrityArticleReferencesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityArticleReferencesPage",
    (args) => content_sync_queries.listIntegrityArticleReferencesPage(args)
  );

const contentSync_queries_integrity_listIntegrityArticlesPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegrityArticlesPage",
    (args) => content_sync_queries.listIntegrityArticlesPage(args)
  );

const contentSync_queries_integrity_listIntegritySubjectSectionsPageImpl =
  FunctionImpl.make(
    api,
    "contentSync.queries.integrity",
    "listIntegritySubjectSectionsPage",
    (args) => content_sync_queries.listIntegritySubjectSectionsPage(args)
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
