import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../../schema";
import groupLayer from "../../../../../contentRelease/runtime/tryout/dispatch.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../../contentRelease/runtime/tryout/dispatch.spec")["default"]>(databaseSchema, groupLayer);
