export interface ParsedHeading {
  children: ParsedHeading[];
  href: string;
  index?: number;
  label: string;
}
