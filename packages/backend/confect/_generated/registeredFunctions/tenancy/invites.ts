import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import invites from "../../../tenancy/invites.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/invites.spec")["default"]>(databaseSchema, invites, RegisteredConvexFunction.make);
