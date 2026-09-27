import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import readState from "../../../../../classes/forums/mutations/readState.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/mutations/readState.spec")["default"]>(databaseSchema, readState, RegisteredConvexFunction.make);
