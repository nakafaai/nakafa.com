import { Spec } from "@confect/core";
import { chatsGroup } from "./modules/chat/chat.spec";
import {
  creditsGroup,
  customersGroup,
  subscriptionsGroup,
} from "./modules/commerce/commerce.spec";
import {
  audioStudiesGroup,
  commentsGroup,
  contentSyncGroup,
  contentsGroup,
  subjectSectionsGroup,
} from "./modules/content/content.spec";
import { authGroup, usersGroup } from "./modules/identity/identity.spec";
import { exercisesGroup } from "./modules/learning/learning.spec";
import {
  emailsGroup,
  notificationsGroup,
} from "./modules/notifications/notifications.spec";
import { triggersGroup } from "./modules/operations/operations.spec";
import {
  assessmentsGroup,
  classesGroup,
  schoolsGroup,
} from "./modules/school/school.spec";
import {
  irtGroup,
  tryoutAccessGroup,
  tryoutsGroup,
} from "./modules/tryout/tryout.spec";

export default Spec.make()
  .add(authGroup)
  .add(usersGroup)
  .add(chatsGroup)
  .add(classesGroup)
  .add(schoolsGroup)
  .add(assessmentsGroup)
  .add(subscriptionsGroup)
  .add(creditsGroup)
  .add(customersGroup)
  .add(commentsGroup)
  .add(contentsGroup)
  .add(contentSyncGroup)
  .add(audioStudiesGroup)
  .add(subjectSectionsGroup)
  .add(exercisesGroup)
  .add(irtGroup)
  .add(tryoutsGroup)
  .add(tryoutAccessGroup)
  .add(emailsGroup)
  .add(notificationsGroup)
  .add(triggersGroup);
