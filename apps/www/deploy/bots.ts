import { BotManagement, type Zone } from "@alchemy.run/cloudflare";
import { Effect } from "effect";

/**
 * The bot policy of the nakafa.com zone, deployed from production only. The AI
 * search, user and training classes all allow at the edge, so answer services can
 * read and cite, and training is refused by robots.txt and one WAF rule, whose
 * expression `renderTrainingCrawlerExpression` writes. The deploy token holds no
 * Zone WAF Write, so that rule stands in Cloudflare outside this stack, and an
 * operator changes it there. Bot Preference Sync, Bot Fight Mode and AI Labyrinth stay off. Alchemy documents
 * `fightMode` as the Free plan's field and the other fields set here as shared
 * across plans. Some accounts still reject a shared field, and then that field is
 * dropped from this resource.
 */
export const deployNakafaBots = Effect.fn("deploy.nakafaBots")(function* (
  zone: Zone.Zone
) {
  yield* BotManagement.BotManagement("NakafaBots", {
    zoneId: zone.zoneId,
    aiSearch: "disabled",
    aiUser: "disabled",
    aiTraining: "disabled",
    botPreferenceSyncEnabled: false,
    crawlerProtection: "disabled",
    fightMode: false,
  });
});
