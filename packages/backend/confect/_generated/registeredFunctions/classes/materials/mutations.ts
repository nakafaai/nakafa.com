import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import mutations from "../../../../classes/materials/mutations.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../classes/materials/mutations.spec")["default"]>(databaseSchema, mutations, RegisteredConvexFunction.make);
