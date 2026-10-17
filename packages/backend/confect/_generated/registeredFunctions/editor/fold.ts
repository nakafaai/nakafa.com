import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import fold from "../../../editor/fold.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../editor/fold.spec")["default"]>(databaseSchema, fold, RegisteredConvexFunction.make);
