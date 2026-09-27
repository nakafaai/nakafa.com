import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import search from "../../../../contents/queries/search.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/queries/search.spec")["default"]>(databaseSchema, search, RegisteredConvexFunction.make);
