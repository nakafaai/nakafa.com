import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import capture from "../../../analytics/capture.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../analytics/capture.spec")["default"]>(databaseSchema, capture, RegisteredConvexFunction.make);
