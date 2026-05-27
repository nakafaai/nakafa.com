import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as school_assessment_attempts from "@repo/backend/confect/modules/school/assessmentsAttempts.service";
import * as school_assessment_assignments from "@repo/backend/confect/modules/school/assessmentsAuthoring/assignments.service";
import * as school_assessment_bank from "@repo/backend/confect/modules/school/assessmentsAuthoring/bank.service";
import * as school_assessment_delete from "@repo/backend/confect/modules/school/assessmentsAuthoring/delete.service";
import * as school_assessment_drafts from "@repo/backend/confect/modules/school/assessmentsAuthoring/drafts.service";
import * as school_assessment_ordering from "@repo/backend/confect/modules/school/assessmentsAuthoring/ordering.service";
import * as school_assessment_publishing from "@repo/backend/confect/modules/school/assessmentsAuthoring/publishing.service";
import * as school_assessment_questions from "@repo/backend/confect/modules/school/assessmentsAuthoring/questions.service";
import * as school_assessment_versions from "@repo/backend/confect/modules/school/assessmentsAuthoring/versions.service";
import * as school_assessment_queries from "@repo/backend/confect/modules/school/assessmentsQueries.service";
import { Effect, Layer } from "effect";

const assessments_mutations_public_save_saveResponseImpl = FunctionImpl.make(
  api,
  "assessments.mutations.publicFunctions.save",
  "saveResponse",
  (args) =>
    school_assessment_attempts.saveResponse(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const assessments_mutations_public_start_startAttemptImpl = FunctionImpl.make(
  api,
  "assessments.mutations.publicFunctions.start",
  "startAttempt",
  (args) =>
    school_assessment_attempts.startAttempt(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const assessments_mutations_public_submit_submitAttemptImpl = FunctionImpl.make(
  api,
  "assessments.mutations.publicFunctions.submit",
  "submitAttempt",
  (args) =>
    school_assessment_attempts.submitAttempt(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const assessments_queries_public_bank_listQuestionBanksImpl = FunctionImpl.make(
  api,
  "assessments.queries.publicFunctions.bank",
  "listQuestionBanks",
  (args) =>
    school_assessment_queries.listQuestionBanks(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const assessments_queries_public_list_listAssessmentsImpl = FunctionImpl.make(
  api,
  "assessments.queries.publicFunctions.list",
  "listAssessments",
  (args) =>
    school_assessment_queries.listAssessments(args).pipe(
      Effect.catchTags({
        AssessmentError: (error) => Effect.die(error),
        ClassActionError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const assessments_mutations_internal_publishing_publishAssessmentImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.internalFunctions.publishing",
    "publishAssessment",
    (args) => school_assessment_publishing.publishAssessment(args)
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
      school_assessment_assignments.createAssignment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_bank.createQuestionBank(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
      )
  );

const assessments_mutations_public_bank_createQuestionBankEntryImpl =
  FunctionImpl.make(
    api,
    "assessments.mutations.publicFunctions.bank",
    "createQuestionBankEntry",
    (args) =>
      school_assessment_bank.createQuestionBankEntry(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_drafts.createAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_delete.deleteAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_questions.createQuestion(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_ordering.reorderAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_questions.createSection(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_drafts.updateAssessment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_versions.createAssessmentVersion(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_attempts.getAssignment(args).pipe(
        Effect.catchTags({
          AssessmentError: (error) => Effect.die(error),
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
      school_assessment_queries.getAuthoredAssessment(args).pipe(
        Effect.catchTags({
          ClassActionError: (error) => Effect.die(error),
          UnauthorizedUser: (error) => Effect.die(error),
        })
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
