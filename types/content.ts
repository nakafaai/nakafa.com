export type Article = {
  title: string;
  description: string;
  date: string;
  slug: string;
  official: boolean;
};

export type Reference = {
  title: string;
  authors: string;
  year: number;
  url?: string;
  citation?: string; // For handling 2024a, 2024b style citations
  publication?: string;
  details?: string;
};

export type ContentMetadata = {
  title: string;
  description: string;
  authors: {
    name: string;
  }[];
  date: string;
  alternates: {
    canonical: string;
  };
  subject?: string;
  category: string;
};

export type ContentPagination = {
  prev: {
    href: string;
    title: string;
  };
  next: {
    href: string;
    title: string;
  };
};
