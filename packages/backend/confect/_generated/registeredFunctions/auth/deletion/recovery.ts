import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import recovery from "../../../../auth/deletion/recovery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../auth/deletion/recovery.spec")["default"]>(databaseSchema, recovery, RegisteredConvexFunction.make);
