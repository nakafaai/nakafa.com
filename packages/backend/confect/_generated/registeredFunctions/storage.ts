import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../schema";
import storage from "../../storage.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../storage.spec")["default"]>(databaseSchema, storage, RegisteredConvexFunction.make);
