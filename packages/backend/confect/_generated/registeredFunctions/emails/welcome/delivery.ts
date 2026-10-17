import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/welcome/delivery.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../emails/welcome/delivery.spec")["default"]>(databaseSchema, groupLayer);
