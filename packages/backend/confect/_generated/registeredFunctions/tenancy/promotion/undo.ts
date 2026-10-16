import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import undo from "../../../../tenancy/promotion/undo.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../tenancy/promotion/undo.spec")["default"]>(databaseSchema, undo, RegisteredConvexFunction.make);
