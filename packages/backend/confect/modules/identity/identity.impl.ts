import { Layer } from "effect";
import { authLayer } from "./auth/auth.impl";
import { usersLayer } from "./users/users.impl";

export const identityLayer = Layer.mergeAll(authLayer, usersLayer);
