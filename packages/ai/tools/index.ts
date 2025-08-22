import { getArticlesTool } from "./articles";
import { calculatorTool } from "./calculator";
import { getContentTool } from "./content";
import { scrapeTool, webSearchTool } from "./firecrawl";
import { getSubjectsTool } from "./subjects";

export const tools = {
  getContent: getContentTool,
  getArticles: getArticlesTool,
  getSubjects: getSubjectsTool,
  calculator: calculatorTool,
  scrape: scrapeTool,
  webSearch: webSearchTool,
};
