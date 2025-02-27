export type PagefindResult = {
  excerpt: string;
  meta: {
    title: string;
  };
  raw_url: string;
  sub_results: {
    excerpt: string;
    title: string;
    url: string;
  }[];
  url: string;
};

/** Options that can be passed to pagefind.search() */
export type PagefindSearchOptions = {
  /** If set, this call will load all assets but return before searching. Prefer using pagefind.preload() instead */
  preload?: boolean;
  /** Add more verbose console logging for this search query */
  verbose?: boolean;
  /** The set of filters to execute with this search. Input type is extremely flexible, see the filtering docs for details */
  filters?: object;
  /** The set of sorts to use for this search, instead of relevancy */
  sort?: object;
};
