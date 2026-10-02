import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import profile from "../../../tenancy/profile.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/profile.spec")["default"]>(databaseSchema, profile, RegisteredConvexFunction.make);
