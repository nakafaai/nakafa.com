import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import accept from "../../../contentRelease/accept.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/accept.spec")["default"]>(databaseSchema, accept, RegisteredConvexFunction.make);
