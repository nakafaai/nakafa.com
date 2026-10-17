import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/invite/delivery.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../emails/invite/delivery.spec")["default"]>(databaseSchema, groupLayer);
