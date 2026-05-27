import { Spec } from "@confect/core";
import { chatsGroup } from "@repo/backend/confect/modules/chat/chats/chats.spec";
import { creditsGroup } from "@repo/backend/confect/modules/commerce/credits/credits.spec";
import { customersGroup } from "@repo/backend/confect/modules/commerce/customers/customers.spec";
import { subscriptionsGroup } from "@repo/backend/confect/modules/commerce/subscriptions/subscriptions.spec";
import { audioStudiesGroup } from "@repo/backend/confect/modules/content/audioStudies/audioStudies.spec";
import { commentsGroup } from "@repo/backend/confect/modules/content/comments/comments.spec";
import { contentSyncGroup } from "@repo/backend/confect/modules/content/contentSync/contentSync.spec";
import { contentsGroup } from "@repo/backend/confect/modules/content/contents/contents.spec";
import { subjectSectionsGroup } from "@repo/backend/confect/modules/content/subjectSections/subjectSections.spec";
import { authGroup } from "@repo/backend/confect/modules/identity/auth/auth.spec";
import { usersGroup } from "@repo/backend/confect/modules/identity/users/users.spec";
import { exercisesGroup } from "@repo/backend/confect/modules/learning/exercises/exercises.spec";
import { emailsGroup } from "@repo/backend/confect/modules/notifications/emails/emails.spec";
import { notificationsGroup } from "@repo/backend/confect/modules/notifications/notifications/notifications.spec";
import { triggersGroup } from "@repo/backend/confect/modules/operations/triggers/triggers.spec";
import { assessmentsGroup } from "@repo/backend/confect/modules/school/assessments/assessments.spec";
import { classesGroup } from "@repo/backend/confect/modules/school/classes/classes.spec";
import { schoolsGroup } from "@repo/backend/confect/modules/school/schools/schools.spec";
import { irtGroup } from "@repo/backend/confect/modules/tryout/irt/irt.spec";
import { tryoutAccessGroup } from "@repo/backend/confect/modules/tryout/tryoutAccess/tryoutAccess.spec";
import { tryoutsGroup } from "@repo/backend/confect/modules/tryout/tryouts/tryouts.spec";

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
