import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import summaries from "../../../nina/summaries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/summaries.spec")["default"]>(databaseSchema, summaries, RegisteredConvexFunction.make);
