import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import internalMutations from "../../../../classes/forums/internalMutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../classes/forums/internalMutations.spec")["default"]>(databaseSchema, internalMutations, RegisteredConvexFunction.make);
