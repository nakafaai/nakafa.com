import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import focus from "../../../nina/focus.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/focus.spec")["default"]>(databaseSchema, focus, RegisteredConvexFunction.make);
