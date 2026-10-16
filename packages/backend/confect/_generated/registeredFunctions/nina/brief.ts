import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import brief from "../../../nina/brief.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/brief.spec")["default"]>(databaseSchema, brief, RegisteredConvexFunction.make);
