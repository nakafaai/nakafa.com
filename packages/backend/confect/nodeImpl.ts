import { Impl } from "@confect/server";
import nodeApi from "@repo/backend/confect/_generated/nodeApi";
import { generated } from "@repo/backend/confect/generated.nodeImpl";
import { authNodeLayer } from "@repo/backend/confect/modules/identity/auth/auth.nodeImpl";
import { Layer } from "effect";

export default Impl.make(nodeApi).pipe(
  Layer.provide(authNodeLayer),
  Layer.provide(generated),
  Impl.finalize
);
