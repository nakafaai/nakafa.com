import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import audit from "../../../journal/audit.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../journal/audit.spec")["default"]>(databaseSchema, audit, RegisteredConvexFunction.make);
