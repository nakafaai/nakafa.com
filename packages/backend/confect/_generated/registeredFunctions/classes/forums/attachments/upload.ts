import { RegisteredConvexFunction, RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import upload from "../../../../../classes/forums/attachments/upload.impl";

export default RegisteredFunctions.buildForGroup<typeof import("../../../../../classes/forums/attachments/upload.spec")["default"]>(databaseSchema, upload, RegisteredConvexFunction.make);
