import { Impl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { chatLayer } from "@repo/backend/confect/modules/chat/chat.impl";
import { commerceLayer } from "@repo/backend/confect/modules/commerce/commerce.impl";
import { contentLayer } from "@repo/backend/confect/modules/content/content.impl";
import { identityLayer } from "@repo/backend/confect/modules/identity/identity.impl";
import { learningLayer } from "@repo/backend/confect/modules/learning/learning.impl";
import { emailsLayer } from "@repo/backend/confect/modules/notifications/emails/emails.impl";
import { notificationsLayer } from "@repo/backend/confect/modules/notifications/notifications/notifications.impl";
import { operationsLayer } from "@repo/backend/confect/modules/operations/operations.impl";
import { schoolLayer } from "@repo/backend/confect/modules/school/school.impl";
import { tryoutLayer } from "@repo/backend/confect/modules/tryout/tryout.impl";
import { Layer } from "effect";

export default Impl.make(api).pipe(
  Layer.provide(identityLayer),
  Layer.provide(chatLayer),
  Layer.provide(schoolLayer),
  Layer.provide(commerceLayer),
  Layer.provide(contentLayer),
  Layer.provide(learningLayer),
  Layer.provide(tryoutLayer),
  Layer.provide(emailsLayer),
  Layer.provide(notificationsLayer),
  Layer.provide(operationsLayer),
  Impl.finalize
);
