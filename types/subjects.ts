export type MaterialList = {
  title: string;
  description?: string;
  href: string;
  items: {
    title: string;
    href: string;
  }[];
};
