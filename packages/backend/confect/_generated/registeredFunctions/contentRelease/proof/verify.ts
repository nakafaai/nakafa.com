import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/proof/verify.impl";

export default RegisteredNodeFunction.buildForGroup<typeof import("../../../../contentRelease/proof/verify.spec")["default"]>(databaseSchema, groupLayer);
