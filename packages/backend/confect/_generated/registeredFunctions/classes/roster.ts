import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import roster from "../../../classes/roster.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../classes/roster.spec")["default"]>(databaseSchema, roster, RegisteredConvexFunction.make);
