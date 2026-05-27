import { GroupSpec } from "@confect/core";
import { assessmentsMutationsPublicAssignGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/assign.spec";
import { assessmentsMutationsPublicBankGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/bank.spec";
import { assessmentsMutationsPublicCreateGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/create.spec";
import { assessmentsMutationsPublicDeleteGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/delete.spec";
import { assessmentsMutationsPublicQuestionsGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/questions.spec";
import { assessmentsMutationsPublicReorderGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/reorder.spec";
import { assessmentsMutationsPublicSaveGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/save.spec";
import { assessmentsMutationsPublicSectionsGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/sections.spec";
import { assessmentsMutationsPublicStartGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/start.spec";
import { assessmentsMutationsPublicSubmitGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/submit.spec";
import { assessmentsMutationsPublicUpdateGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/update.spec";
import { assessmentsMutationsPublicVersionGroup } from "@repo/backend/confect/modules/school/assessments/mutations/publicFunctions/version.spec";

const assessmentsMutationsPublicGroup = GroupSpec.make("publicFunctions")
  .addGroup(assessmentsMutationsPublicAssignGroup)
  .addGroup(assessmentsMutationsPublicCreateGroup)
  .addGroup(assessmentsMutationsPublicUpdateGroup)
  .addGroup(assessmentsMutationsPublicVersionGroup)
  .addGroup(assessmentsMutationsPublicQuestionsGroup)
  .addGroup(assessmentsMutationsPublicSectionsGroup)
  .addGroup(assessmentsMutationsPublicReorderGroup)
  .addGroup(assessmentsMutationsPublicDeleteGroup)
  .addGroup(assessmentsMutationsPublicBankGroup)
  .addGroup(assessmentsMutationsPublicSaveGroup)
  .addGroup(assessmentsMutationsPublicStartGroup)
  .addGroup(assessmentsMutationsPublicSubmitGroup);

export { assessmentsMutationsPublicGroup };
