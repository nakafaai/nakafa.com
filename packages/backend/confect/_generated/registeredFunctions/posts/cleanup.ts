import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import cleanup from "../../../posts/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../posts/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
