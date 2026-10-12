import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import search from "../../../../contents/sections/search.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/sections/search.spec")["default"]>(databaseSchema, search, RegisteredNodeFunction.make);
