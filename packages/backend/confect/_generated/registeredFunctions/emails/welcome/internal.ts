import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../emails/welcome/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/welcome/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
