import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/sections/build.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../contents/sections/build.spec")["default"]>(databaseSchema, groupLayer);
