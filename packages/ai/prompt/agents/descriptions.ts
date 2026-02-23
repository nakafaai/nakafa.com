/**
 * Centralized descriptions for agents and tools
 *
 * All agent and tool descriptions are defined here to avoid
 * hardcoding strings in implementation files.
 *
 * Evidence of AI SDK best practices:
 * - Clear, concise descriptions help the model understand tool purposes
 * - Consistent formatting across all descriptions
 * - References: https://ai-sdk.dev/docs/agents/building-agents#tools
 */

// Agent Descriptions

/**
 * Research agent description
 * Used in orchestrator routing and tool definitions
 */
export function researchAgentDescription(): string {
  return "Research specialist that searches the web and scrapes external content. Use for: web searches, analyzing external URLs, gathering information from outside Nakafa.";
}

/**
 * Study agent description
 * Used in orchestrator routing and tool definitions
 */
export function studyAgentDescription(): string {
  return "Study specialist that retrieves Nakafa's educational content. Use for: finding subjects, articles, and lessons within Nakafa's knowledge base.";
}

/**
 * Math agent description
 * Used in orchestrator routing and tool definitions
 */
export function mathAgentDescription(): string {
  return "Math specialist that performs calculations. Use for: arithmetic, equations, mathematical problem solving, and any calculations.";
}

// Tool Descriptions

/**
 * Web search tool description
 */
export function webSearchToolDescription(): string {
  return "Search the web for current information. Returns search results with titles, URLs, and summaries.";
}

/**
 * Scrape tool description
 */
export function scrapeToolDescription(): string {
  return "Scrape and extract content from external URLs. Use for analyzing specific web pages. Only works with external URLs (not nakafa.com).";
}

/**
 * Get subjects tool description
 */
export function getSubjectsToolDescription(): string {
  return "Retrieve the list of available subjects in Nakafa's content system. Use to discover what subjects are available.";
}

/**
 * Get articles tool description
 */
export function getArticlesToolDescription(): string {
  return "Search and retrieve articles from Nakafa's content system. Use to find educational articles on specific topics.";
}

/**
 * Get content tool description
 */
export function getContentToolDescription(): string {
  return "Retrieve full content (lessons, articles, exercises) from Nakafa by slug. Use to get detailed educational content.";
}

/**
 * Calculator tool description
 */
export function calculatorToolDescription(): string {
  return "Perform mathematical calculations with precision. Use for ALL math - even simple calculations like 2+2. Supports arithmetic, algebra, and complex expressions.";
}

// Delegate Tool Description

/**
 * Delegate tool description for orchestrator
 */
export function delegateToolDescription(): string {
  return "Delegate tasks to specialized sub-agents. Choose the appropriate agent based on the task: research (web/external), study (Nakafa content), or math (calculations).";
}
