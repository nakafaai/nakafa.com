import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import verification from "../../../../auth/deletion/verification.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../auth/deletion/verification.spec")["default"]>(databaseSchema, verification, RegisteredConvexFunction.make);
