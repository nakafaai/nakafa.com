import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/digest/delivery.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../emails/digest/delivery.spec")["default"]>(databaseSchema, groupLayer);
