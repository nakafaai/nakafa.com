import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import settings from "../../../tenancy/settings.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/settings.spec")["default"]>(databaseSchema, settings, RegisteredConvexFunction.make);
