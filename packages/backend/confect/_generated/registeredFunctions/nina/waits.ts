import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import waits from "../../../nina/waits.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/waits.spec")["default"]>(databaseSchema, waits, RegisteredConvexFunction.make);
