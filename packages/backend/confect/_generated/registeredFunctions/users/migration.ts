import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import migration from "../../../users/migration.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../users/migration.spec")["default"]>(databaseSchema, migration, RegisteredConvexFunction.make);
