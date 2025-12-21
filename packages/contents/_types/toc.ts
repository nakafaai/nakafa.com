export interface ParsedHeading {
  label: string;
  href: string;
  index?: number; // this is used for virtualized list
  children?: ParsedHeading[];
}
