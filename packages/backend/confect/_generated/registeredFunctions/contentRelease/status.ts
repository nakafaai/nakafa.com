import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import status from "../../../contentRelease/status.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/status.spec")["default"]>(databaseSchema, status, RegisteredConvexFunction.make);
