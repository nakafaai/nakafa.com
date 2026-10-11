import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import rows from "../../../../contents/sections/rows.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/sections/rows.spec")["default"]>(databaseSchema, rows, RegisteredConvexFunction.make);
