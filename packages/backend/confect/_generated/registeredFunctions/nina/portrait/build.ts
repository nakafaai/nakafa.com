import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import build from "../../../../nina/portrait/build.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../nina/portrait/build.spec")["default"]>(databaseSchema, build, RegisteredNodeFunction.make);
