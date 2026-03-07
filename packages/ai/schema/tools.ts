import * as z from "zod";

const toolNameSchema = z.enum([
  "contentAccess",
  "deepResearch",
  "mathCalculation",
]);
export type ToolName = z.infer<typeof toolNameSchema>;
