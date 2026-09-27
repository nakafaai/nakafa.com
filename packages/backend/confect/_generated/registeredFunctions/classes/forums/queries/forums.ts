import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import forums from "../../../../../classes/forums/queries/forums.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/queries/forums.spec")["default"]>(databaseSchema, forums, RegisteredConvexFunction.make);
