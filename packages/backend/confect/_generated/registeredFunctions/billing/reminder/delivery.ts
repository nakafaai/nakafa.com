import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../billing/reminder/delivery.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../billing/reminder/delivery.spec")["default"]>(databaseSchema, groupLayer);
