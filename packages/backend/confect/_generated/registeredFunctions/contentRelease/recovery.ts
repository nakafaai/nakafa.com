import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import recovery from "../../../contentRelease/recovery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/recovery.spec")["default"]>(databaseSchema, recovery, RegisteredConvexFunction.make);
