import { Array as Arr, Schema } from "effect";

/**
 * A training-only crawler that Nakafa refuses. `sentAs` holds what its requests
 * carry in their user agent, in lowercase, and stays empty for a token that only
 * robots.txt names: Applebot-Extended is never sent in a request, because Apple
 * fetches the pages as Applebot.
 */
const TrainingCrawler = Schema.Struct({
  sentAs: Schema.Array(Schema.String),
  token: Schema.String,
});

const TrainingCrawlers = Schema.Array(TrainingCrawler);

/**
 * The training-only crawlers that robots.txt names and the edge refuses. No other
 * module lists these names.
 */
export const TRAINING_CRAWLERS: typeof TrainingCrawlers.Type = [
  { sentAs: ["gptbot"], token: "GPTBot" },
  // Claude-User and Claude-SearchBot read and cite, and their user agents hold
  // `claudebot@anthropic.com` as a contact, so only the name with its version is this crawler.
  { sentAs: ["claudebot/"], token: "ClaudeBot" },
  { sentAs: ["ccbot"], token: "CCBot" },
  { sentAs: ["bytespider"], token: "Bytespider" },
  { sentAs: ["meta-externalagent"], token: "meta-externalagent" },
  { sentAs: ["amazonbot"], token: "Amazonbot" },
  { sentAs: [], token: "Applebot-Extended" },
];

/**
 * The edge rule's expression: the lowercased user agent contains one refused
 * token. A token that no request carries is left out.
 */
export function renderTrainingCrawlerExpression(
  crawlers: typeof TrainingCrawlers.Type
) {
  const matches = Arr.map(
    Arr.flatMap(crawlers, (crawler) => crawler.sentAs),
    (text) => `lower(http.user_agent) contains "${text}"`
  );
  return `(${Arr.join(matches, " or ")})`;
}
