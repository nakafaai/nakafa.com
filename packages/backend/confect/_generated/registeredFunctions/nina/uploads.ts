import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import uploads from "../../../nina/uploads.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/uploads.spec")["default"]>(databaseSchema, uploads, RegisteredConvexFunction.make);
