import { GroupSpec } from "@confect/core";
import { assessmentsMutationsPublicAssignGroup } from "./assign.spec";
import { assessmentsMutationsPublicBankGroup } from "./bank.spec";
import { assessmentsMutationsPublicCreateGroup } from "./create.spec";
import { assessmentsMutationsPublicDeleteGroup } from "./delete.spec";
import { assessmentsMutationsPublicQuestionsGroup } from "./questions.spec";
import { assessmentsMutationsPublicReorderGroup } from "./reorder.spec";
import { assessmentsMutationsPublicSaveGroup } from "./save.spec";
import { assessmentsMutationsPublicSectionsGroup } from "./sections.spec";
import { assessmentsMutationsPublicStartGroup } from "./start.spec";
import { assessmentsMutationsPublicSubmitGroup } from "./submit.spec";
import { assessmentsMutationsPublicUpdateGroup } from "./update.spec";
import { assessmentsMutationsPublicVersionGroup } from "./version.spec";

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
