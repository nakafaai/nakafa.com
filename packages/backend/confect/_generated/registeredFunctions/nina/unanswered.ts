import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import unanswered from "../../../nina/unanswered.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/unanswered.spec")["default"]>(databaseSchema, unanswered, RegisteredConvexFunction.make);
