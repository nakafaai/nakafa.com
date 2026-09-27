import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import reference from "../../../contentRelease/reference.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../contentRelease/reference.spec")["default"]>(databaseSchema, reference, RegisteredConvexFunction.make);
