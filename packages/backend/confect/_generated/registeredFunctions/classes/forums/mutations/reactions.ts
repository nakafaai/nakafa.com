import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import reactions from "../../../../../classes/forums/mutations/reactions.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/mutations/reactions.spec")["default"]>(databaseSchema, reactions, RegisteredConvexFunction.make);
