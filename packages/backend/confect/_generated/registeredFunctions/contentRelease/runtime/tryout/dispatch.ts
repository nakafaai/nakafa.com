import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../../schema";
import dispatch from "../../../../../contentRelease/runtime/tryout/dispatch.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../contentRelease/runtime/tryout/dispatch.spec")["default"]>(databaseSchema, dispatch, RegisteredNodeFunction.make);
