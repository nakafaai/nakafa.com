import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import queries from "../../../classes/queries.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../classes/queries.spec")["default"]>(databaseSchema, queries, RegisteredConvexFunction.make);
