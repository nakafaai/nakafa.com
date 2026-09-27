import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import recovery from "../../../privacy/recovery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../privacy/recovery.spec")["default"]>(databaseSchema, recovery, RegisteredConvexFunction.make);
