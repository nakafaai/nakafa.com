import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internal from "../../../../emails/invite/internal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/invite/internal.spec")["default"]>(databaseSchema, internal, RegisteredConvexFunction.make);
