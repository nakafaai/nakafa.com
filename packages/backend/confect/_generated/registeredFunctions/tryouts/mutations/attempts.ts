import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import attempts from "../../../../tryouts/mutations/attempts.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tryouts/mutations/attempts.spec")["default"]>(databaseSchema, attempts, RegisteredConvexFunction.make);
