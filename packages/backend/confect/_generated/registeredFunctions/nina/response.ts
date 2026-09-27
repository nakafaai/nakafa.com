import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../schema";
import response from "../../../nina/response.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../nina/response.spec")["default"]>(databaseSchema, response, RegisteredNodeFunction.make);
