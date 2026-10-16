import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import staff from "../../../operators/staff.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../operators/staff.spec")["default"]>(databaseSchema, staff, RegisteredConvexFunction.make);
