import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../customers/integrity/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/integrity/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
