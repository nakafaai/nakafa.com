import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import cleanup from "../../../../customers/deletion/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../customers/deletion/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
