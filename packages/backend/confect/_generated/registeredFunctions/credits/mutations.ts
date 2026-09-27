import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import mutations from "../../../credits/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../credits/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
