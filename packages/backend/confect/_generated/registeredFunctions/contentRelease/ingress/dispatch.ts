import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/ingress/dispatch.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../contentRelease/ingress/dispatch.spec")["default"]>(databaseSchema, groupLayer);
