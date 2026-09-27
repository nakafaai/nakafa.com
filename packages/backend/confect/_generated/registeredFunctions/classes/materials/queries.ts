import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import queries from "../../../../classes/materials/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../classes/materials/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
