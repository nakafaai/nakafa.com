import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import turns from "../../../nina/turns.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/turns.spec")["default"]>(databaseSchema, turns, RegisteredConvexFunction.make);
