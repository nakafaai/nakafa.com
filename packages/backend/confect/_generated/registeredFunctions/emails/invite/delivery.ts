import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import delivery from "../../../../emails/invite/delivery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/invite/delivery.spec")["default"]>(databaseSchema, delivery, RegisteredNodeFunction.make);
