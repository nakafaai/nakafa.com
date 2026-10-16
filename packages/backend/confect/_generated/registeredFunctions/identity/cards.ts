import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import cards from "../../../identity/cards.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../identity/cards.spec")["default"]>(databaseSchema, cards, RegisteredConvexFunction.make);
