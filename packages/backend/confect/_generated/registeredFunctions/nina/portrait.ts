import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import portrait from "../../../nina/portrait.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/portrait.spec")["default"]>(databaseSchema, portrait, RegisteredConvexFunction.make);
