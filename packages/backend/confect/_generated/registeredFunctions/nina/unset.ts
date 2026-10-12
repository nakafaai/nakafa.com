import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import unset from "../../../nina/unset.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/unset.spec")["default"]>(databaseSchema, unset, RegisteredConvexFunction.make);
