import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import cleanup from "../../../auth/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
