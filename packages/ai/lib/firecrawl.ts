import FirecrawlApp from "@mendable/firecrawl-js";
import { keys } from "../keys";

export const firecrawlApp = new FirecrawlApp({
  apiKey: keys().FIRECRAWL_API_KEY,
});
