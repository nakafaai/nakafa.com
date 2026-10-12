import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import rekey from "../../../../nina/memory/rekey.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../nina/memory/rekey.spec")["default"]>(databaseSchema, rekey, RegisteredConvexFunction.make);
