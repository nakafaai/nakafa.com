import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import {
  getAssignment as schoolAssessmentAttempts_getAssignment,
  saveResponse as schoolAssessmentAttempts_saveResponse,
  startAttempt as schoolAssessmentAttempts_startAttempt,
  submitAttempt as schoolAssessmentAttempts_submitAttempt,
} from "@repo/backend/confect/modules/school/assessmentsAttempts.service";
import { createAssignment as schoolAssessmentAssignments_createAssignment } from "@repo/backend/confect/modules/school/assessmentsAuthoring/assignments.service";
import {
  createQuestionBank as schoolAssessmentBank_createQuestionBank,
  createQuestionBankEntry as schoolAssessmentBank_createQuestionBankEntry,
} from "@repo/backend/confect/modules/school/assessmentsAuthoring/bank.service";
import { deleteAssessment as schoolAssessmentDelete_deleteAssessment } from "@repo/backend/confect/modules/school/assessmentsAuthoring/delete.service";
import {
  createAssessment as schoolAssessmentDrafts_createAssessment,
  updateAssessment as schoolAssessmentDrafts_updateAssessment,
} from "@repo/backend/confect/modules/school/assessmentsAuthoring/drafts.service";
import { reorderAssessment as schoolAssessmentOrdering_reorderAssessment } from "@repo/backend/confect/modules/school/assessmentsAuthoring/ordering.service";
import { publishAssessment as schoolAssessmentPublishing_publishAssessment } from "@repo/backend/confect/modules/school/assessmentsAuthoring/publishing.service";
import {
  createQuestion as schoolAssessmentQuestions_createQuestion,
  createSection as schoolAssessmentQuestions_createSection,
} from "@repo/backend/confect/modules/school/assessmentsAuthoring/questions.service";
import { createAssessmentVersion as schoolAssessmentVersions_createAssessmentVersion } from "@repo/backend/confect/modules/school/assessmentsAuthoring/versions.service";
import {
  getAuthoredAssessment as schoolAssessmentQueries_getAuthoredAssessment,
  listAssessments as schoolAssessmentQueries_listAssessments,
  listQuestionBanks as schoolAssessmentQueries_listQuestionBanks,
} from "@repo/backend/confect/modules/school/assessmentsQueries.service";
import { Effect, Layer } from "effect";

const assessments_mutations_public_save_saveResponseImpl = FunctionImpl.make(
  api,
  "assessments.mutations.publicFunctions.save",
  "saveResponse",
  (args) =>
    schoolAssessmentAttempts_saveResponse(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const assessments_mutations_public_start_startAttemptImpl = FunctionImpl.make(
  api,
  "assessments.mutations.publicFunctions.start",
  "startAttempt",
  (args) =>
    schoolAssessmentAttempts_startAttempt(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const assessments_mutations_public_submit_submitAttemptImpl = FunctionImpl.make(
  api,
  "assessments.mutations.publicFunctions.submit",
  "submitAttempt",
  (args) =>
    schoolAssessmentAttempts_submitAttempt(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const assessments_queries_public_bank_listQuestionBanksImpl = FunctionImpl.make(
  api,
  "assessments.queries.publicFunctions.bank",
  "listQuestionBanks",
  (args) =>
    schoolAssessmentQueries_listQuestionBanks(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const assessments_queries_public_list_listAssessmentsImpl = FunctionImpl.make(
  api,
  "assessments.queries.publicFunctions.list",
  "listAssessments",
  (args) =>
    schoolAssessmentQueries_listAssessments(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      }),
      Effect.orDie
    )
);

const assessments_mutations_internal_publishing_publishAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.internalFunctions.publishing",
    "publishAssessment",
    (args) =>
      schoolAssessmentPublishing_publishAssessment(args).pipe(Effect.orDie)
  );

const assessmentsMutationsInternalPublishingImpl = GroupImpl.make(
  api,
  "assessments.mutations.internalFunctions.publishing"
).pipe(
  Layer.provide(assessments_mutations_internal_publishing_publishAssessmentImpl)
);

const assessments_mutations_public_assign_createAssignmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.assign",
    "createAssignment",
    (args) =>
      schoolAssessmentAssignments_createAssignment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicAssignImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.assign"
).pipe(Layer.provide(assessments_mutations_public_assign_createAssignmentImpl));

const assessments_mutations_public_bank_createQuestionBankImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.bank",
    "createQuestionBank",
    (args) =>
      schoolAssessmentBank_createQuestionBank(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessments_mutations_public_bank_createQuestionBankEntryImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.bank",
    "createQuestionBankEntry",
    (args) =>
      schoolAssessmentBank_createQuestionBankEntry(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicBankImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.bank"
)
  .pipe(Layer.provide(assessments_mutations_public_bank_createQuestionBankImpl))
  .pipe(
    Layer.provide(assessments_mutations_public_bank_createQuestionBankEntryImpl)
  );

const assessments_mutations_public_create_createAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.create",
    "createAssessment",
    (args) =>
      schoolAssessmentDrafts_createAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicCreateImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.create"
).pipe(Layer.provide(assessments_mutations_public_create_createAssessmentImpl));

const assessments_mutations_public_delete_deleteAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.deleteFunctions",
    "deleteAssessment",
    (args) =>
      schoolAssessmentDelete_deleteAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicDeleteImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.deleteFunctions"
).pipe(Layer.provide(assessments_mutations_public_delete_deleteAssessmentImpl));

const assessments_mutations_public_questions_createQuestionImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.questions",
    "createQuestion",
    (args) =>
      schoolAssessmentQuestions_createQuestion(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicQuestionsImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.questions"
).pipe(
  Layer.provide(assessments_mutations_public_questions_createQuestionImpl)
);

const assessments_mutations_public_reorder_reorderAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.reorder",
    "reorderAssessment",
    (args) =>
      schoolAssessmentOrdering_reorderAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicReorderImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.reorder"
).pipe(
  Layer.provide(assessments_mutations_public_reorder_reorderAssessmentImpl)
);

const assessmentsMutationsPublicSaveImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.save"
).pipe(Layer.provide(assessments_mutations_public_save_saveResponseImpl));

const assessments_mutations_public_sections_createSectionImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.sections",
    "createSection",
    (args) =>
      schoolAssessmentQuestions_createSection(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicSectionsImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.sections"
).pipe(Layer.provide(assessments_mutations_public_sections_createSectionImpl));

const assessmentsMutationsPublicStartImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.start"
).pipe(Layer.provide(assessments_mutations_public_start_startAttemptImpl));

const assessmentsMutationsPublicSubmitImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.submit"
).pipe(Layer.provide(assessments_mutations_public_submit_submitAttemptImpl));

const assessments_mutations_public_update_updateAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.update",
    "updateAssessment",
    (args) =>
      schoolAssessmentDrafts_updateAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicUpdateImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.update"
).pipe(Layer.provide(assessments_mutations_public_update_updateAssessmentImpl));

const assessments_mutations_public_version_createAssessmentVersionImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.version",
    "createAssessmentVersion",
    (args) =>
      schoolAssessmentVersions_createAssessmentVersion(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsMutationsPublicVersionImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions.version"
).pipe(
  Layer.provide(
    assessments_mutations_public_version_createAssessmentVersionImpl
  )
);

const assessments_queries_public_assignment_getAssignmentImpl =
  FunctionImpl.make(
    api,
    "assessments.queries.publicFunctions.assignment",
    "getAssignment",
    (args) =>
      schoolAssessmentAttempts_getAssignment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsQueriesPublicAssignmentImpl = GroupImpl.make(
  api,
  "assessments.queries.publicFunctions.assignment"
).pipe(Layer.provide(assessments_queries_public_assignment_getAssignmentImpl));

const assessments_queries_public_authoring_getAuthoredAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.queries.publicFunctions.authoring",
    "getAuthoredAssessment",
    (args) =>
      schoolAssessmentQueries_getAuthoredAssessment(args).pipe(
        Effect.catchTags({
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        }),
        Effect.orDie
      )
  );

const assessmentsQueriesPublicAuthoringImpl = GroupImpl.make(
  api,
  "assessments.queries.publicFunctions.authoring"
).pipe(
  Layer.provide(assessments_queries_public_authoring_getAuthoredAssessmentImpl)
);

const assessmentsQueriesPublicBankImpl = GroupImpl.make(
  api,
  "assessments.queries.publicFunctions.bank"
).pipe(Layer.provide(assessments_queries_public_bank_listQuestionBanksImpl));

const assessmentsQueriesPublicListImpl = GroupImpl.make(
  api,
  "assessments.queries.publicFunctions.list"
).pipe(Layer.provide(assessments_queries_public_list_listAssessmentsImpl));

const assessmentsMutationsInternalImpl = GroupImpl.make(
  api,
  "assessments.mutations.internalFunctions"
).pipe(Layer.provide(assessmentsMutationsInternalPublishingImpl));

const assessmentsMutationsPublicImpl = GroupImpl.make(
  api,
  "assessments.mutations.publicFunctions"
)
  .pipe(Layer.provide(assessmentsMutationsPublicAssignImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicBankImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicCreateImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicDeleteImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicQuestionsImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicReorderImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicSaveImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicSectionsImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicStartImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicSubmitImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicUpdateImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicVersionImpl));

const assessmentsQueriesPublicImpl = GroupImpl.make(
  api,
  "assessments.queries.publicFunctions"
)
  .pipe(Layer.provide(assessmentsQueriesPublicAssignmentImpl))
  .pipe(Layer.provide(assessmentsQueriesPublicAuthoringImpl))
  .pipe(Layer.provide(assessmentsQueriesPublicBankImpl))
  .pipe(Layer.provide(assessmentsQueriesPublicListImpl));

const assessmentsMutationsImpl = GroupImpl.make(api, "assessments.mutations")
  .pipe(Layer.provide(assessmentsMutationsInternalImpl))
  .pipe(Layer.provide(assessmentsMutationsPublicImpl));

const assessmentsQueriesImpl = GroupImpl.make(api, "assessments.queries").pipe(
  Layer.provide(assessmentsQueriesPublicImpl)
);

const assessmentsImpl = GroupImpl.make(api, "assessments")
  .pipe(Layer.provide(assessmentsMutationsImpl))
  .pipe(Layer.provide(assessmentsQueriesImpl));

export const assessmentsLayer = Layer.mergeAll(assessmentsImpl);
