import { Impl } from "@confect/server";
import { Layer } from "effect";
import api from "./_generated/api";
import { chatLayer } from "./modules/chat/chat.impl";
import { commerceLayer } from "./modules/commerce/commerce.impl";
import { contentLayer } from "./modules/content/content.impl";
import { identityLayer } from "./modules/identity/identity.impl";
import { learningLayer } from "./modules/learning/learning.impl";
import { notificationsLayer } from "./modules/notifications/notifications.impl";
import { operationsLayer } from "./modules/operations/operations.impl";
import { schoolLayer } from "./modules/school/school.impl";
import { tryoutLayer } from "./modules/tryout/tryout.impl";

export default Impl.make(api).pipe(
  Layer.provide(identityLayer),
  Layer.provide(chatLayer),
  Layer.provide(schoolLayer),
  Layer.provide(commerceLayer),
  Layer.provide(contentLayer),
  Layer.provide(learningLayer),
  Layer.provide(tryoutLayer),
  Layer.provide(notificationsLayer),
  Layer.provide(operationsLayer),
  Impl.finalize
);
