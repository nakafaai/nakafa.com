import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import purge from "../../../notifications/purge.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../notifications/purge.spec")["default"]>(databaseSchema, purge, RegisteredConvexFunction.make);
