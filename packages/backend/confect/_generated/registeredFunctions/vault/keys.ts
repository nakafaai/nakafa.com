import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import keys from "../../../vault/keys.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../vault/keys.spec")["default"]>(databaseSchema, keys, RegisteredConvexFunction.make);
