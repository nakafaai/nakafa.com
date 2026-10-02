import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import viewer from "../../../tenancy/viewer.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../tenancy/viewer.spec")["default"]>(databaseSchema, viewer, RegisteredConvexFunction.make);
