import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import verify from "../../../contentRelease/verify.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/verify.spec")["default"]>(databaseSchema, verify, RegisteredConvexFunction.make);
