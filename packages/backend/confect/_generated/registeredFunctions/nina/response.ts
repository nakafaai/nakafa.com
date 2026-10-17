import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/response.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../nina/response.spec")["default"]>(databaseSchema, groupLayer);
