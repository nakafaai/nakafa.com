import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import activate from "../../../contentRelease/activate.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/activate.spec")["default"]>(databaseSchema, activate, RegisteredConvexFunction.make);
