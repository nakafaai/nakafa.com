import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import build from "../../../../contents/sections/build.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contents/sections/build.spec")["default"]>(databaseSchema, build, RegisteredNodeFunction.make);
