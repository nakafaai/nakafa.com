import { authLayer } from "@repo/backend/confect/modules/identity/auth/auth.impl";
import { usersLayer } from "@repo/backend/confect/modules/identity/users/users.impl";
import { Layer } from "effect";

export const identityLayer = Layer.mergeAll(authLayer, usersLayer);
