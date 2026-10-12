import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import judgment from "../../../nina/judgment.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/judgment.spec")["default"]>(databaseSchema, judgment, RegisteredConvexFunction.make);
