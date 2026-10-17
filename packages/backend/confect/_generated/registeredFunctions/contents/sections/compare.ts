import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/sections/compare.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../contents/sections/compare.spec")["default"]>(databaseSchema, groupLayer);
