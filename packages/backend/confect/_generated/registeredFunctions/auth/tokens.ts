import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import tokens from "../../../auth/tokens.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../auth/tokens.spec")["default"]>(databaseSchema, tokens, RegisteredConvexFunction.make);
