import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/draw.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../billing/draw.spec")["default"]>(databaseSchema, groupLayer);
