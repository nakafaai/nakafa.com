import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import cleanup from "../../../../triggers/comments/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../triggers/comments/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
