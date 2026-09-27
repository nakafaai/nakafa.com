import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import dispatch from "../../../../contentRelease/ingress/dispatch.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../contentRelease/ingress/dispatch.spec")["default"]>(databaseSchema, dispatch, RegisteredNodeFunction.make);
