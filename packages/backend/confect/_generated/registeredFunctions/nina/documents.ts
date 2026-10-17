import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/documents.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../nina/documents.spec")["default"]>(databaseSchema, groupLayer);
