import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { answerTurn } from "@repo/backend/confect/nina/answer";
import spec from "@repo/backend/confect/nina/documents.spec";
import { Layer } from "effect";

const run = FunctionImpl.make(schema, spec, "run", answerTurn);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
