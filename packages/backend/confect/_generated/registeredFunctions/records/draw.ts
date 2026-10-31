import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../schema";
import groupLayer from "../../../records/draw.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../records/draw.spec")["default"]>(databaseSchema, groupLayer);
