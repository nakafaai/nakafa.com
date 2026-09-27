import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import attempt from "../../../../tryouts/queries/attempt.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/queries/attempt.spec")["default"]>(databaseSchema, attempt, RegisteredConvexFunction.make);
