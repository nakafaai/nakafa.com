import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import cleanup from "../../../../triggers/schools/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../triggers/schools/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
