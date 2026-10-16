import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import provision from "../../../tenancy/provision.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/provision.spec")["default"]>(databaseSchema, provision, RegisteredConvexFunction.make);
