import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import compare from "../../../../contents/sections/compare.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/sections/compare.spec")["default"]>(databaseSchema, compare, RegisteredNodeFunction.make);
