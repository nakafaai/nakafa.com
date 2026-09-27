import { RegisteredFunctions } from "@confect/server";
import { RegisteredNodeFunction } from "@confect/server/node";
import databaseSchema from "../../../schema";
import delivery from "../../../../emails/welcome/delivery.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../emails/welcome/delivery.spec")["default"]>(databaseSchema, delivery, RegisteredNodeFunction.make);
