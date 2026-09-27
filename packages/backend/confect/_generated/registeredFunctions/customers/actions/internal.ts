import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../customers/actions/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/actions/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
