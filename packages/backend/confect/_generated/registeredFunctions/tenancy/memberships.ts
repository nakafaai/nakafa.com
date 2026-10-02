import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import memberships from "../../../tenancy/memberships.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/memberships.spec")["default"]>(databaseSchema, memberships, RegisteredConvexFunction.make);
