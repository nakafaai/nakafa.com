import { createApi } from "@convex-dev/better-auth";
import { createAuth } from "../auth";
import schema from "./generatedSchema";

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuth);
