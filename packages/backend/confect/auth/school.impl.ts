import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { signInSchoolLogin } from "@repo/backend/confect/auth/school";
import spec from "@repo/backend/confect/auth/school.spec";
import { Layer } from "effect";

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(FunctionImpl.make(schema, spec, "signIn", signInSchoolLogin)),
  GroupImpl.finalize
);
