import * as z from "zod";

const ParsedHeadingSchema = z.object({
  label: z.string(),
  href: z.string(),
  index: z.number().optional(), // this is used for virtualized list
  get children() {
    return z.array(ParsedHeadingSchema);
  },
});

export type ParsedHeading = z.infer<typeof ParsedHeadingSchema>;
