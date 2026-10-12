import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import state from "../../../../contents/sections/state.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/sections/state.spec")["default"]>(databaseSchema, state, RegisteredConvexFunction.make);
