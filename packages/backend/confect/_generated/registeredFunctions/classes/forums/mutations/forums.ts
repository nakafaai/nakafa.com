import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import forums from "../../../../../classes/forums/mutations/forums.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/mutations/forums.spec")["default"]>(databaseSchema, forums, RegisteredConvexFunction.make);
