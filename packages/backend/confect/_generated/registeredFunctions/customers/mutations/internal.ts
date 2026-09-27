import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../customers/mutations/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/mutations/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
