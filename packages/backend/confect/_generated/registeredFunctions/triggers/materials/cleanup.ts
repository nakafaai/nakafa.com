import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import cleanup from "../../../../triggers/materials/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../triggers/materials/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
