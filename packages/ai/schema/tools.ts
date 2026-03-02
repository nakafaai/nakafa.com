import * as z from "zod";

const toolNameSchema = z.literal([
  "contentAccess",
  "deepResearch",
  "mathCalculation",
]);
export type ToolName = z.infer<typeof toolNameSchema>;
