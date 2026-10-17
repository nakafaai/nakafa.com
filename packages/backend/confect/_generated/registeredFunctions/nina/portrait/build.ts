import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../nina/portrait/build.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../nina/portrait/build.spec")["default"]>(databaseSchema, groupLayer);
