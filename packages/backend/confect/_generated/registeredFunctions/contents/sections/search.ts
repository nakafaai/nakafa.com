import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/sections/search.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../contents/sections/search.spec")["default"]>(databaseSchema, groupLayer);
