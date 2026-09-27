import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../classes/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../classes/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
