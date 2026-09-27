import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import cleanup from "../../../contentRelease/cleanup.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/cleanup.spec")["default"]>(databaseSchema, cleanup, RegisteredConvexFunction.make);
