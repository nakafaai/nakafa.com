import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import reshape from "../../../nina/reshape.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/reshape.spec")["default"]>(databaseSchema, reshape, RegisteredConvexFunction.make);
