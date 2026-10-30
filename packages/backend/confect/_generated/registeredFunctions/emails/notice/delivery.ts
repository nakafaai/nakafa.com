import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/notice/delivery.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../emails/notice/delivery.spec")["default"]>(databaseSchema, groupLayer);
