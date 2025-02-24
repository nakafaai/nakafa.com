export type Reference = {
  title: string;
  authors: string;
  year: number;
  url?: string;
  citation?: string; // For handling 2024a, 2024b style citations
  publication?: string;
  details?: string;
};
