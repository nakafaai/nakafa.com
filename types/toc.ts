import { z } from "zod/v4";

export const HeadingTagSchema = z.enum(["h1", "h2", "h3", "h4", "h5", "h6"]);
export type HeadingTag = z.infer<typeof HeadingTagSchema>;

export const TocHeadingSchema = z.object({
  id: z.string(),
  text: z.string(),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  tag: HeadingTagSchema,
});
export type TocHeading = z.infer<typeof TocHeadingSchema>;

export const ParsedHeadingSchema: z.ZodType<ParsedHeading> = z.lazy(() =>
  z.object({
    label: z.string(),
    href: z.string(),
    children: z.array(ParsedHeadingSchema).optional(),
  })
);
export type ParsedHeading = {
  label: string;
  href: string;
  children?: ParsedHeading[];
};
