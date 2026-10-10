import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import seal from "../../../nina/seal.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/seal.spec")["default"]>(databaseSchema, seal, RegisteredConvexFunction.make);
