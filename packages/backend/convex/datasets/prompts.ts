import { dedentString } from "@repo/ai/lib/utils";
import { createPrompt } from "@repo/ai/prompt/utils";

/**
 * Schema description for generating column schema.
 */
export function generateColumnsSchemaDescription() {
  return dedentString(`
    # Schema Description

    Generate an array of column definitions for a research dataset.

    Each column must include:
    - \`name\`: Camel case field name (e.g., \`annualRevenue\`, \`employeeCount\`, \`entityName\`)
    - \`displayName\`: Human-readable title in the query's language (e.g., "Annual Revenue (USD)", "Nama Perusahaan")
    - \`dataType\`: One of: text, number, url, date, boolean, json
    - \`description\`: Clear explanation of what this field represents in the query's language
    - \`unit\`: Unit of measurement (e.g., "USD", "employees", "%") - optional but recommended for numbers
    - \`isRequired\`: Boolean indicating if this field is mandatory

    CRITICAL: ALWAYS generate these 3 required columns FIRST:
    1. entityName (text, required) - Display name in query's language
    2. description (text, required) - Display name in query's language  
    3. url (url, required) - Display name in query's language

    Then generate additional columns based on what the research query requires.
  `);
}

/**
 * Prompt for generating column schema from user's research query.
 */
export function generateColumnsPrompt({ query }: { query: string }) {
  return createPrompt({
    taskContext: `
      # Task: Generate Column Schema

      You are an expert data architect. Your task is to analyze a research query and generate an optimal column schema for a dataset that will be populated by deep web research.

      Research Query: "${query}"

      CRITICAL: Detect the language of the query and generate ALL display names and descriptions in that language.

      The columns you generate will determine what data is researched and extracted for each entity. Choose columns that are:
      - Highly relevant to the research goal
      - Quantifiable and researchable from web sources
      - Valuable for professional analysis
      - Likely to have publicly available data
    `,

    detailedTaskInstructions: `
      # Column Generation Rules

      ## Language Detection (CRITICAL)
      1. Detect the language from the research query
      2. Generate ALL displayName and description fields in that detected language
      3. Keep column names in camelCase (always English)
      
      Examples:
      - English query: "European SaaS companies" → displayName: "Entity Name", "Description", "Website"
      - Indonesian query: "perusahaan SaaS Eropa" → displayName: "Nama Entitas", "Deskripsi", "Situs Web"
      - Spanish query: "empresas SaaS europeas" → displayName: "Nombre de Entidad", "Descripción", "Sitio Web"

      ## Required Columns (MUST GENERATE FIRST)
      ALWAYS generate these 3 columns FIRST in the detected language:
      
      1. Entity Name Column:
         - name: "entityName"
         - displayName: Translated to query language (e.g., "Entity Name" / "Nama Entitas" / "Nombre de Entidad")
         - dataType: "text"
         - description: Translated explanation (e.g., "The name of the entity" / "Nama entitas" / "El nombre de la entidad")
         - isRequired: true
      
      2. Description Column:
         - name: "description"
         - displayName: Translated to query language (e.g., "Description" / "Deskripsi" / "Descripción")
         - dataType: "text"
         - description: Translated explanation (e.g., "Brief description of the entity" / "Deskripsi singkat entitas" / "Breve descripción de la entidad")
         - isRequired: true
      
      3. Website Column:
         - name: "url"
         - displayName: Translated to query language (e.g., "Website" / "Situs Web" / "Sitio Web")
         - dataType: "url"
         - description: Translated explanation (e.g., "Official website URL" / "URL situs web resmi" / "URL del sitio web oficial")
         - isRequired: true

      ## Naming Conventions
      - Column name: Use camelCase (e.g., "annualRevenue", "employeeCount", "entityName")
      - Display name: Translate to query language with Title Case, include units (e.g., "Annual Revenue (USD)" / "Pendapatan Tahunan (USD)")
      - Always include currency/unit in display name when applicable

      ## Data Types
      - text: For strings, categories, names, addresses
      - number: For quantities, money, counts, percentages (stored as raw numbers)
      - url: For website links
      - date: For dates, founding years
      - boolean: For yes/no fields
      - json: For complex structured data

      ## Unit Specifications
      - Money fields: MUST include currency (USD, EUR, GBP, etc.)
      - Detect currency from context:
        * European companies → EUR
        * US/Global companies → USD
        * UK companies → GBP
      - Other units: employees, %, kg, etc.

      ## Additional Columns Strategy
      After the 3 required columns, generate additional columns that are directly relevant to the research query.
      
      The number and type of additional columns should be determined entirely by what the query asks for:
      - If the query asks for financial data, generate financial columns
      - If the query asks for team information, generate team-related columns
      - If the query asks for product details, generate product columns
      
      Generate as many or as few additional columns as needed - no minimum or maximum.
    `,

    examples: `
      # Examples

      <example>
      Query: "European SaaS companies with revenue data" (English detected)
      
      Columns:
      [
        {
          name: "entityName",
          displayName: "Entity Name",
          dataType: "text",
          description: "The name of the entity",
          isRequired: true
        },
        {
          name: "description",
          displayName: "Description",
          dataType: "text",
          description: "Brief description of the entity",
          isRequired: true
        },
        {
          name: "url",
          displayName: "Website",
          dataType: "url",
          description: "Official website URL",
          isRequired: true
        },
        {
          name: "annualRevenue",
          displayName: "Annual Revenue (EUR)",
          dataType: "number",
          unit: "EUR",
          description: "Total annual recurring revenue in euros",
          isRequired: false
        }
      ]
      
      Note: First 3 columns are REQUIRED (in English). Then added revenue column because query asks for "revenue data".
      </example>

      <example>
      Query: "perusahaan SaaS Eropa dengan data pendapatan" (Indonesian detected)
      
      Columns:
      [
        {
          name: "entityName",
          displayName: "Nama Entitas",
          dataType: "text",
          description: "Nama entitas",
          isRequired: true
        },
        {
          name: "description",
          displayName: "Deskripsi",
          dataType: "text",
          description: "Deskripsi singkat entitas",
          isRequired: true
        },
        {
          name: "url",
          displayName: "Situs Web",
          dataType: "url",
          description: "URL situs web resmi",
          isRequired: true
        },
        {
          name: "annualRevenue",
          displayName: "Pendapatan Tahunan (EUR)",
          dataType: "number",
          unit: "EUR",
          description: "Total pendapatan tahunan berulang dalam euro",
          isRequired: false
        }
      ]
      
      Note: First 3 columns are REQUIRED (in Indonesian). Then added revenue column with Indonesian display name.
      </example>

      <example>
      Query: "Y Combinator AI startups with funding and team size" (English detected)
      
      Columns:
      [
        {
          name: "entityName",
          displayName: "Entity Name",
          dataType: "text",
          description: "The name of the entity",
          isRequired: true
        },
        {
          name: "description",
          displayName: "Description",
          dataType: "text",
          description: "Brief description of the entity",
          isRequired: true
        },
        {
          name: "url",
          displayName: "Website",
          dataType: "url",
          description: "Official website URL",
          isRequired: true
        },
        {
          name: "totalFunding",
          displayName: "Total Funding (USD)",
          dataType: "number",
          unit: "USD",
          description: "Total amount raised across all funding rounds",
          isRequired: false
        },
        {
          name: "ycBatch",
          displayName: "YC Batch",
          dataType: "text",
          description: "Y Combinator batch (e.g., W21, S22)",
          isRequired: false
        },
        {
          name: "employeeCount",
          displayName: "Employee Count",
          dataType: "number",
          unit: "employees",
          description: "Total number of full-time employees",
          isRequired: false
        }
      ]
      
      Note: First 3 columns are REQUIRED. Then added funding, YC batch, and employee count columns.
      </example>

      <example>
      Query: "Tech companies in San Francisco" (English detected)
      
      Columns:
      [
        {
          name: "entityName",
          displayName: "Entity Name",
          dataType: "text",
          description: "The name of the entity",
          isRequired: true
        },
        {
          name: "description",
          displayName: "Description",
          dataType: "text",
          description: "Brief description of the entity",
          isRequired: true
        },
        {
          name: "url",
          displayName: "Website",
          dataType: "url",
          description: "Official website URL",
          isRequired: true
        },
        {
          name: "headquarters",
          displayName: "Headquarters",
          dataType: "text",
          description: "Primary office location (city, state, country)",
          isRequired: false
        },
        {
          name: "industry",
          displayName: "Industry",
          dataType: "text",
          description: "Primary technology sector or industry vertical",
          isRequired: false
        }
      ]
      
      Note: First 3 columns are REQUIRED. Then added location and industry columns. No financial data requested, so none added.
      </example>
    `,

    finalRequest: `
      Generate columns for the research query following this order:
      
      1. FIRST: Always generate the 3 required columns (entityName, description, url) with displayName and description in the query's detected language
      2. THEN: Generate additional columns based on what the query requires
      
      Language detection is CRITICAL - all displayName and description fields must be in the query's language.
      Column names remain in camelCase (English).
      
      Ensure currency codes are included where applicable.
      Return complete columns array with all required fields.
    `,
  });
}

/**
 * Prompt for generating search queries to find specific field data.
 */
export function generateFieldQueriesPrompt({
  entityName,
  entityDescription,
  fieldName,
  fieldDescription,
}: {
  entityName: string;
  entityDescription: string;
  fieldName: string;
  fieldDescription: string;
}) {
  return createPrompt({
    taskContext: `
      # Task: Generate Search Queries

      You are a search query specialist. Generate 3 specific, targeted search queries to find "${fieldName}" for "${entityName}".

      Entity Context:
      - Name: ${entityName}
      - Description: ${entityDescription}

      Field Context:
      - Field: ${fieldName}
      - Description: ${fieldDescription}
    `,

    detailedTaskInstructions: `
      # Query Generation Rules

      ## Objectives
      - Find OFFICIAL, VERIFIED information only
      - Prioritize recent data (use current year when relevant)
      - Target authoritative sources (company websites, official reports, verified databases)
      - Avoid speculative or rumor-based sources

      ## Query Strategies
      1. Direct query: "[Entity] [field] [year]"
      2. Contextual query: "[Entity] [related terms] [field]"
      3. Alternative query: "[Entity] [synonyms] [field]"

      ## Source Prioritization
      Prefer queries that will return:
      - Official company websites and press releases
      - Financial databases (Crunchbase, PitchBook)
      - Reputable news sources (TechCrunch, Forbes, Bloomberg)
      - Government filings and regulatory documents
      - Industry reports and analyst coverage
    `,

    examples: `
      # Examples

      <example>
      Entity: "Stripe"
      Field: "Annual Revenue"

      Queries:
      1. "Stripe annual revenue 2024 financial results"
      2. "Stripe ARR recurring revenue latest"
      3. "Stripe total revenue earnings report"
      </example>

      <example>
      Entity: "OpenAI"
      Field: "Employee Count"

      Queries:
      1. "OpenAI employee count total employees 2024"
      2. "OpenAI workforce size team headcount"
      3. "OpenAI number of employees LinkedIn"
      </example>

      <example>
      Entity: "Anthropic"
      Field: "Latest Funding Round"

      Queries:
      1. "Anthropic latest funding round Series C 2024"
      2. "Anthropic recent investment valuation"
      3. "Anthropic venture capital funding announcement"
      </example>
    `,

    finalRequest: `
      Generate exactly 3 diverse, specific search queries that will find official data for ${fieldName}.
      Vary query structure to maximize source coverage.
      Return queries array.
    `,
  });
}

/**
 * Prompt for extracting field values from multiple sources.
 */
export function extractFieldValuePrompt({
  entityName,
  fieldName,
  fieldType,
  fieldUnit,
  sourcesContext,
}: {
  entityName: string;
  fieldName: string;
  fieldType: string;
  fieldUnit?: string;
  sourcesContext: string;
}) {
  return createPrompt({
    taskContext: `
      # Task: Extract Field Value

      You are a precise data extraction specialist. Extract "${fieldName}" for "${entityName}" from multiple web sources.

      Field Information:
      - Name: ${fieldName}
      - Type: ${fieldType}
      ${fieldUnit ? `- Unit: ${fieldUnit}` : ""}

      You have access to ${sourcesContext.split("SOURCE").length - 1} sources to analyze.
    `,

    detailedTaskInstructions: `
      # Extraction Rules

      ## Critical Requirements
      1. Return null if information not found with confidence > 50%
      2. NEVER guess or hallucinate data
      3. Cross-reference multiple sources for accuracy
      4. Prioritize latest information (check dates in sources!)
      5. Verify data consistency across sources

      ## Data Type Handling
      - For numbers: Extract raw value only (e.g., 394.3 for "$394.3B" or "394.3 million")
      - For money: Remove currency symbols, convert to base unit (millions, billions)
      - For dates: Use YYYY format for years, YYYY-MM-DD for full dates
      - For text: Be concise and factual, remove marketing fluff
      - For booleans: Only if explicitly stated

      ## Source Evaluation
      Prioritize sources in this order:
      1. Official company websites and investor relations pages
      2. Government filings and regulatory documents (SEC, Companies House)
      3. Major financial databases (Crunchbase, PitchBook)
      4. Reputable business news (Bloomberg, Forbes, WSJ, TechCrunch)
      5. Industry analysts and research firms

      ## Confidence Scoring
      - 0.9-1.0: Multiple authoritative sources agree, official confirmation
      - 0.7-0.9: Reputable sources agree, recent data
      - 0.5-0.7: Some sources agree, or single authoritative source
      - 0.3-0.5: Uncertain, conflicting sources, or outdated data
      - 0.0-0.3: No reliable data found (return null)

      ## Citation Requirements
      For each source you use:
      - Provide exact excerpt (quote from the source)
      - Explain why this source is relevant
      - Include individual confidence score for this source
      - Note the date if mentioned in source
    `,

    examples: `
      # Examples

      <example>
      Entity: "Stripe"
      Field: "Annual Revenue"
      
      Sources say:
      - Forbes (2024): "Stripe's revenue reached $14 billion in 2023"
      - Crunchbase: "Revenue: $14B (2023)"
      - TechCrunch: "Stripe surpassed $14 billion in annual revenue"

      Response:
      {
        "value": 14000000000,
        "confidence": 0.95,
        "reasoning": "All three major sources consistently report $14B revenue for 2023. This is the most recent confirmed figure.",
        "citations": [
          {
            "source": "https://forbes.com/stripe-revenue",
            "excerpt": "Stripe's revenue reached $14 billion in 2023",
            "confidence": 0.95,
            "reasoning": "Forbes article from official earnings announcement"
          },
          {
            "source": "https://crunchbase.com/stripe",
            "excerpt": "Revenue: $14B (2023)",
            "confidence": 0.90,
            "reasoning": "Verified database entry"
          }
        ]
      }
      </example>

      <example>
      Entity: "PrivateStartup Inc"
      Field: "Annual Revenue"
      
      Sources say:
      - Blog post: "Estimated around $5-10M"
      - News article: "Sources say revenue could be $8M"
      - LinkedIn: No mention

      Response:
      {
        "value": null,
        "confidence": 0,
        "reasoning": "Only unverified estimates found (range: $5-10M). No official confirmation. Private company does not disclose revenue publicly.",
        "citations": []
      }
      </example>
    `,

    backgroundData: `
      # Available Sources

      ${sourcesContext}
    `,

    finalRequest: `
      Extract ${fieldName} for ${entityName}.
      
      Return JSON with:
      - value: extracted value or null
      - confidence: 0-1 (e.g., 0.95 for 95%, NOT 95)
      - reasoning: overall explanation (why this value or why not found)
      - citations: array of sources with individual reasoning

      If confidence < 50%, return null with explanation.
    `,
  });
}

/**
 * Schema description for generating entity search queries.
 */
export function generateEntitySearchQueriesSchemaDescription() {
  return dedentString(`
    # Schema Description

    Generate an array of diverse search queries to discover different entities.

    The schema expects:
    - \`queries\`: Array of strings, each representing a unique search query

    Each query should:
    - Target DIFFERENT entities to maximize coverage
    - Use different keywords, locations, or segments
    - Focus on finding official entity websites (not articles)
    - Be specific and actionable for web search

    Return exactly the requested number of diverse queries.
  `);
}

/**
 * Prompt for generating diverse search queries for entity discovery.
 */
export function generateEntitySearchQueriesPrompt({
  query,
  count,
}: {
  query: string;
  count: number;
}) {
  return createPrompt({
    taskContext: `
      # Task: Generate Diverse Entity Search Queries

      You are a search strategy specialist. Generate ${count} diverse search queries to discover different entities for: "${query}"

      Each query should target DIFFERENT entities to maximize coverage and avoid overlap.
    `,

    detailedTaskInstructions: `
      # Query Generation Rules

      ## Objectives
      - Each query must return DIFFERENT entities (minimize overlap)
      - Focus on finding official entity websites (not articles about entities)
      - Maximize diversity across all queries
      - Target ${count} different "buckets" or "segments" of entities

      ## Diversification Strategies
      Vary queries by:
      - Geographic location (different countries, cities, regions)
      - Industry subcategory (different verticals, specializations)
      - Company size (enterprise, mid-market, SMB, startups)
      - Funding stage (seed, Series A-D, public, bootstrapped)
      - Use case or target market
      - Technology stack or product type
      - Time period (founded 2020+, established pre-2010)

      ## Query Optimization
      - Use "site:" operators to focus on specific domains (.com, .fr, .de, .co.uk)
      - Include year to get current companies (2024, 2023)
      - Use "official website" or "company" to filter out articles
      - Avoid generic terms that return directories (crunchbase, wikipedia)
    `,

    examples: `
      # Examples

      <example>
      Query: "European SaaS companies"
      Count: 5

      Diverse queries:
      1. "B2B SaaS companies France site:.fr OR site:.com official website"
      2. "enterprise software startups Germany 2024 site:.de"
      3. "SaaS platform UK fintech company site:.co.uk"
      4. "cloud software Netherlands Spain site:.nl OR site:.es"
      5. "European SaaS unicorn companies series C funding"

      Why diverse: Different countries, different stages, different keywords
      </example>

      <example>
      Query: "AI startups in Bay Area"
      Count: 3

      Diverse queries:
      1. "AI machine learning startups San Francisco 2024"
      2. "generative AI companies Silicon Valley Series A"
      3. "AI research labs Palo Alto Stanford spinoff"

      Why diverse: Different locations, different AI types, different origins
      </example>

      <example>
      Query: "Sustainable fashion brands"
      Count: 4

      Diverse queries:
      1. "sustainable clothing brands Europe ethical fashion"
      2. "eco-friendly apparel companies USA organic cotton"
      3. "circular fashion startups recycled materials"
      4. "sustainable luxury fashion brands high-end"

      Why diverse: Different regions, different approaches, different market segments
      </example>
    `,

    finalRequest: `
      Generate exactly ${count} diverse search queries for: "${query}"
      
      Each query should target a DIFFERENT segment of entities.
      Maximize variety to discover unique entities.
      Return queries array.
    `,
  });
}

/**
 * Schema description for extracting entities from scraped content.
 */
export function extractEntitiesFromContentSchemaDescription() {
  return dedentString(`
    # Schema Description

    Extract entity information (name and URL) from scraped web content.

    The schema expects:
    - \`entities\`: Array of extracted entities

    Each entity object must include:
    - \`name\`: String - clean entity name (company, organization, product name)
    - \`url\`: String - official website URL of the entity
    - \`reasoning\`: String - brief explanation of where this entity was found in the content

    Extract ALL valid entities mentioned in the content with their official URLs.
    Only include entities with valid, official website URLs (not social media, not directories).
  `);
}

/**
 * Prompt for extracting entities from scraped article/web content.
 */
export function extractEntitiesFromContentPrompt({
  originalQuery,
  scrapedSources,
}: {
  originalQuery: string;
  scrapedSources: Array<{
    sourceUrl: string;
    title: string;
    content: string;
  }>;
}) {
  return createPrompt({
    taskContext: `
      # Task: Extract Entities from Web Content

      You are an entity extraction specialist. Your task is to extract entity information (name and official URL) from scraped web content.

      Original Research Query: "${originalQuery}"
      Sources to analyze: ${scrapedSources.length}

      The content you're analyzing may be articles, listicles, directories, or comparison pages that MENTION multiple entities.
      Your goal is to extract the actual entities being discussed, along with their official website URLs.
    `,

    detailedTaskInstructions: `
      # Extraction Rules

      ## What to Extract
      - Entity name: Company, organization, product, or service name
      - Official URL: The entity's primary website (not the article URL)
      - Extract ALL relevant entities mentioned in the content

      ## Entity Name Guidelines
      - Use clean, official names (no taglines or suffixes)
      - Remove "Inc.", "Ltd.", "Corp.", country codes
      - Keep brand names short and clear
      - Example: "Stripe, Inc." → "Stripe"

      ## URL Validation - Extract ONLY Official Websites
      ✅ VALID URLs to extract:
      - Official company websites (stripe.com, openai.com)
      - Official product sites (algolia.com)
      - Root domains or primary pages (example.com, example.com/en)
      - .com, .io, .ai, .co, etc. owned by the entity

      ❌ INVALID URLs - DO NOT extract:
      - Social media (linkedin.com/company/*, twitter.com/*)
      - Directories (crunchbase.com/*, producthunt.com/*)
      - Wikipedia (wikipedia.org/*)
      - Review sites (g2.com/*, capterra.com/*)
      - App stores (apps.apple.com/*, play.google.com/*)
      - Job boards (indeed.com/*, glassdoor.com/*)
      - The article's own URL (extract entities FROM the article, not the article itself)

      ## Content Analysis Strategy
      1. Look for entity mentions in:
         - List items (numbered lists, bullet points)
         - Headings and subheadings
         - Paragraphs describing companies/products
         - Comparison tables
         - Link text and URLs
      
      2. Extract official URLs by:
         - Finding URLs in the content that point to entity websites
         - Looking for patterns like "Visit [entity] at [url]"
         - Identifying clean domain names mentioned
      
      3. Relevance check:
         - Only extract entities relevant to the research query
         - Skip entities mentioned in passing or unrelated

      ## Quality Criteria
      - Only include entities with BOTH name AND valid URL
      - Skip entities without official URLs
      - Deduplicate (same entity mentioned multiple times)
      - Prioritize entities most relevant to the query
    `,

    examples: `
      # Examples

      <example>
      Query: "European SaaS companies"
      
      Content:
      "Top European SaaS Companies in 2024:
      
      1. Stripe (https://stripe.com) - Payment processing platform based in Ireland
      2. Algolia (https://algolia.com) - French search API company
      3. UiPath (https://uipath.com) - Romanian RPA software company
      
      You can find Stripe on LinkedIn at linkedin.com/company/stripe"

      Extracted Entities:
      [
        {
          "name": "Stripe",
          "url": "https://stripe.com",
          "reasoning": "Found in list item 1 with official URL"
        },
        {
          "name": "Algolia",
          "url": "https://algolia.com",
          "reasoning": "Found in list item 2 with official URL"
        },
        {
          "name": "UiPath",
          "url": "https://uipath.com",
          "reasoning": "Found in list item 3 with official URL"
        }
      ]
      
      Note: LinkedIn URL was NOT extracted (social media, not official site)
      </example>

      <example>
      Query: "AI startups"
      
      Content:
      "Article about AI companies. OpenAI (openai.com) is leading the space. 
      Check their Crunchbase at crunchbase.com/organization/openai. 
      Anthropic is another player but no URL mentioned. 
      Read more articles on our blog."

      Extracted Entities:
      [
        {
          "name": "OpenAI",
          "url": "https://openai.com",
          "reasoning": "Entity mentioned with official domain"
        }
      ]
      
      Note: 
      - Anthropic not extracted (no URL provided)
      - Crunchbase URL not extracted (directory, not official site)
      - Blog not extracted (not an entity)
      </example>

      <example>
      Query: "Y Combinator startups"
      
      Content:
      "This article is about YC companies but contains no entity URLs, 
      only mentions companies by name without links."

      Extracted Entities:
      []
      
      Note: No entities extracted because no official URLs found
      </example>
    `,

    backgroundData: buildScrapedSourcesContext(scrapedSources),

    finalRequest: `
      Extract ALL relevant entities from the content with their official URLs.
      
      Return JSON with entities array:
      - name: clean entity name
      - url: official website URL (MUST be the entity's own site)
      - reasoning: where/how this entity was found
      
      Only include entities with VALID official URLs.
      Exclude social media, directories, and the article's own URL.
      Return empty array if no valid entities found.
    `,
  });
}

/**
 * Helper: Build context from scraped sources.
 */
function buildScrapedSourcesContext(
  sources: Array<{
    sourceUrl: string;
    title: string;
    content: string;
  }>
): string {
  const formatted = sources.map((s, idx) => {
    const contentPreview = s.content
      ? s.content.substring(0, 2000)
      : "[No content]";

    return `SOURCE ${idx + 1}:
Article URL: ${s.sourceUrl}
Title: ${s.title}
Content:
${contentPreview}
---`;
  });

  return `# Scraped Content to Analyze\n\n${formatted.join("\n\n")}`;
}

/**
 * Schema description for extracting entity descriptions.
 */
export function extractDescriptionsSchemaDescription() {
  return dedentString(`
    # Schema Description

    Extract concise descriptions for entities from their scraped website content.

    The schema expects:
    - \`descriptions\`: Array of description objects

    Each description object must include:
    - \`name\`: String - the entity name (must match the input entity name exactly)
    - \`description\`: String - concise one-sentence description (max 150 characters)

    Format: "[Name] is a [category] that [offering]."

    If content is empty or unclear, return empty string for description (do NOT invent).
  `);
}

/**
 * Prompt for extracting descriptions from scraped content.
 */
export function extractDescriptionsFromContentPrompt({
  scrapedData,
}: {
  scrapedData: Array<{
    entityName: string;
    url: string;
    content: string;
  }>;
}) {
  return createPrompt({
    taskContext: `
      # Task: Extract Entity Descriptions from Web Content

      You are a professional content analyzer. Extract concise, informative descriptions for these entities based on their actual website content.

      Number of entities: ${scrapedData.length}

      You have the scraped content from each entity's official website. Use this content to understand what each entity actually does.
    `,

    detailedTaskInstructions: `
      # Description Extraction Rules

      ## Format
      "[Entity name] is a [category] [type] that [main offering/focus]."

      ## Requirements
      - Maximum 150 characters
      - One sentence only
      - Extract from the actual website content provided
      - Focus on factual information from their own description
      - Be specific about what they do based on their content
      - Use present tense
      - NO marketing fluff or generic terms

      ## Extraction Strategy
      Look for in the content:
      1. Homepage hero/headline sections
      2. "About us" or "What we do" sections
      3. Product/service descriptions
      4. Company taglines or mission statements
      5. Meta descriptions

      ## Key Elements to Extract
      1. Category: Industry/sector from their own description
      2. Type: Company, platform, organization, service (from content)
      3. Core offering: What they provide (use their own words, simplified)
      4. Target market: Who they serve (if mentioned)
    `,

    examples: `
      # Examples

      <example>
      Entity: "Stripe"
      URL: "stripe.com"
      Content: "# Payments infrastructure for the internet
      
      Millions of companies use Stripe to accept payments, send payouts, and manage their businesses online. Stripe provides APIs and tools for developers to build payment solutions..."

      Extracted Description:
      "Stripe is a payments infrastructure company that provides APIs for online payment processing."

      Why good: Uses their own description ("payments infrastructure"), mentions core offering (APIs), factual
      </example>

      <example>
      Entity: "Algolia"
      URL: "algolia.com"
      Content: "# API-First Search and Discovery Platform
      
      Build exceptional search experiences with our API-based platform. Algolia enables developers to create fast, relevant search for websites and mobile applications..."

      Extracted Description:
      "Algolia is a search-as-a-service platform that provides API-based search solutions for websites and apps."

      Why good: Extracted "API-based platform" from content, describes what they enable developers to do
      </example>

      <example>
      Entity: "Personio"
      URL: "personio.com"
      Content: "# All-in-One HR Software for SMEs
      
      Personio is the people operating system for small and medium-sized companies. Manage recruiting, payroll, attendance, and employee data in one place..."

      Extracted Description:
      "Personio is an HR management platform that offers recruitment, payroll, and employee management for SMEs."

      Why good: Used their own tagline (HR software for SMEs), listed specific features from content
      </example>

      <example>
      Entity: "ObscureStartup"
      URL: "obscurestartup.com"
      Content: "" (empty - scrape failed or no content)

      Extracted Description:
      "" (empty string)

      Why: No content available, cannot extract description. Return empty rather than guessing.
      </example>
    `,

    backgroundData: buildScrapedDataContext(scrapedData),

    finalRequest: `
      Extract a concise description for each entity based on their website content.
      
      Format: "[Name] is a [category] that [offering]."
      Maximum 150 characters per description.
      
      If content is empty or unclear, return empty string (do NOT invent descriptions).
      
      Return JSON with descriptions array matching the order of entities.
    `,
  });
}

/**
 * Helper: Build clean context from scraped data.
 */
function buildScrapedDataContext(
  scrapedData: Array<{
    entityName: string;
    url: string;
    content: string;
  }>
): string {
  const entities = scrapedData.map((data, idx) => {
    const contentPreview = data.content
      ? data.content.substring(0, 800)
      : "[No content - scrape failed]";

    const number = idx + 1;
    return `${number}. ${data.entityName} (${data.url})\n   Content: ${contentPreview}\n   ---`;
  });

  return `# Scraped Content to Analyze\n\n${entities.join("\n\n")}`;
}

/**
 * Schema description for generating field search queries.
 */
export function generateFieldQueriesSchemaDescription() {
  return dedentString(`
    # Schema Description

    Generate 3 specific search queries to find a particular field value for an entity.

    The schema expects:
    - \`queries\`: Array of exactly 3 strings, each representing a unique search query

    Each query should:
    - Target the specific field value for the entity
    - Use varied keywords and structures
    - Prioritize official, authoritative sources
    - Include current year when relevant for recency

    Return exactly 3 diverse search queries.
  `);
}

/**
 * Prompt for generating search queries for a specific field.
 */
export function generateFieldSearchQueriesPrompt({
  entityName,
  fieldName,
  fieldDescription,
  currentDate,
}: {
  entityName: string;
  fieldName: string;
  fieldDescription?: string;
  currentDate: string;
}) {
  return createPrompt({
    taskContext: `
      # Task: Generate Field-Specific Search Queries

      You are a search query specialist. Generate 3 specific search queries to find "${fieldName}" for "${entityName}".

      Entity: ${entityName}
      Field: ${fieldName}
      ${fieldDescription ? `Description: ${fieldDescription}` : ""}
      Current Date: ${currentDate}
    `,

    detailedTaskInstructions: `
      # Query Generation Rules

      ## Objectives
      - Find OFFICIAL, VERIFIED information for this specific field
      - Prioritize recent data (use current year from date provided)
      - Target authoritative sources only
      - Vary query structure for broader coverage

      ## Query Strategies
      1. Direct query with year: "[Entity] [field] [year]"
      2. Contextual query: "[Entity] [related terms] [field]"
      3. Source-specific query: "[Entity] [field] [source type]"

      ## Keywords to Use
      - For financial data: revenue, ARR, earnings, financial results, annual report
      - For team size: employees, workforce, team size, headcount
      - For funding: funding, investment, valuation, Series X, raised
      - For dates: founded, established, started, launched
      - For location: headquarters, office, based in, located

      ## Authoritative Source Hints
      - Add "official" or "announcement" for company data
      - Include "report" or "filing" for financial data
      - Use "LinkedIn" for employee counts
      - Reference "Crunchbase" or "PitchBook" for funding
    `,

    examples: `
      # Examples

      <example>
      Entity: "Stripe"
      Field: "Annual Revenue"
      Current: 2024

      Queries:
      1. "Stripe annual revenue 2024 financial results"
      2. "Stripe ARR recurring revenue latest earnings"
      3. "Stripe total revenue SEC filing 2024"
      </example>

      <example>
      Entity: "OpenAI"
      Field: "Employee Count"
      Current: 2024

      Queries:
      1. "OpenAI employee count 2024 total employees"
      2. "OpenAI team size workforce headcount"
      3. "OpenAI number of employees LinkedIn company"
      </example>

      <example>
      Entity: "Anthropic"
      Field: "Total Funding"
      Current: 2024

      Queries:
      1. "Anthropic total funding raised 2024"
      2. "Anthropic funding rounds investment history Crunchbase"
      3. "Anthropic venture capital funding announcement"
      </example>
    `,

    finalRequest: `
      Generate exactly 3 diverse, specific search queries to find ${fieldName} for ${entityName}.
      Use current year from the date provided.
      Vary structure to maximize source coverage.
      Return queries array.
    `,
  });
}

/**
 * Schema description for extracting field values.
 */
export function extractFieldValueSchemaDescription() {
  return dedentString(`
    # Schema Description

    Extract a specific field value from multiple web sources with citations.

    The schema expects:
    - \`value\`: The extracted value (string, number, boolean, or null if not found)
    - \`confidence\`: Number between 0-1 (e.g., 0.95 for 95% confidence, NOT 95)
    - \`reasoning\`: String explaining the extraction (why this value or why not found)
    - \`citations\`: Array of source citations

    Each citation must include:
    - \`sourceIndex\`: Number - which source from the provided list (0-based)
    - \`excerpt\`: String - exact quote from the source
    - \`confidence\`: Number between 0-1 for this specific source
    - \`date\`: String (optional) - date mentioned in the source

    Return null for value if not found or confidence < 50%.
  `);
}

/**
 * Prompt for extracting field value from sources.
 */
export function extractFieldValueFromSourcesPrompt({
  entityName,
  fieldName,
  fieldType,
  fieldUnit,
  sourcesContext,
  currentDate,
}: {
  entityName: string;
  fieldName: string;
  fieldType: string;
  fieldUnit?: string;
  sourcesContext: string;
  currentDate: string;
}) {
  return createPrompt({
    taskContext: `
      # Task: Extract Field Value

      You are a precise data extraction specialist. Extract "${fieldName}" for "${entityName}" from multiple web sources.

      Field Information:
      - Name: ${fieldName}
      - Type: ${fieldType}
      ${fieldUnit ? `- Unit: ${fieldUnit}` : ""}
      - Current Date: ${currentDate}
    `,

    detailedTaskInstructions: `
      # Extraction Rules

      ## Critical Requirements
      1. Return null if information not found OR confidence < 50%
      2. NEVER guess or hallucinate data
      3. Cross-reference multiple sources for accuracy
      4. Prioritize LATEST information (check dates in sources!)
      5. Verify data consistency across sources

      ## Data Type Handling
      - For numbers: Extract raw value only (e.g., 394.3 for "$394.3B" or "394.3 million")
      - For money: Remove currency symbols, express in base unit
      - For dates: Use YYYY format for years, YYYY-MM-DD for full dates
      - For text: Be concise and factual, remove marketing language
      - For booleans: Only if explicitly stated

      ## Source Evaluation Priority
      1. Official company websites and IR pages (highest priority)
      2. Government filings (SEC, Companies House)
      3. Financial databases (Crunchbase, PitchBook, Bloomberg)
      4. Reputable business news (Forbes, WSJ, TechCrunch)
      5. Industry analysts and research firms

      ## Confidence Scoring Guidelines
      - 0.9-1.0: Multiple authoritative sources agree, official confirmation
      - 0.7-0.9: Reputable sources agree, recent data (within 1 year)
      - 0.5-0.7: Single authoritative source OR multiple less authoritative
      - 0.3-0.5: Uncertain, conflicting sources, OR outdated (>2 years)
      - 0.0-0.3: No reliable data (MUST return null)

      ## Citation Requirements
      - Provide exact excerpt (verbatim quote from source)
      - Explain why this source is relevant
      - Individual confidence score per source
      - Include date if mentioned in source content
    `,

    examples: `
      # Examples

      <example>
      Entity: "Stripe"
      Field: "Annual Revenue"
      Type: number
      Unit: USD

      Sources:
      - Forbes 2024: "Stripe's revenue reached $14 billion in 2023"
      - Crunchbase: "Revenue: $14B (2023)"
      - TechCrunch: "Stripe surpassed $14 billion annually"

      Response:
      {
        "value": 14000000000,
        "confidence": 0.95,
        "reasoning": "All three major sources consistently report $14B revenue for 2023. Official figures confirmed by Forbes citing company announcement.",
        "citations": [
          {
            "sourceIndex": 0,
            "excerpt": "Stripe's revenue reached $14 billion in 2023",
            "confidence": 0.95,
            "date": "2024"
          },
          {
            "sourceIndex": 1,
            "excerpt": "Revenue: $14B (2023)",
            "confidence": 0.90
          }
        ]
      }
      </example>

      <example>
      Entity: "PrivateStartup"
      Field: "Annual Revenue"
      Type: number

      Sources:
      - Blog: "Estimated $5-10M range"
      - Article: "Sources say around $8M"

      Response:
      {
        "value": null,
        "confidence": 0,
        "reasoning": "Only unverified estimates found (range: $5-10M). No official confirmation. Private company does not publicly disclose revenue.",
        "citations": []
      }
      </example>
    `,

    backgroundData: `
      # Available Sources

      ${sourcesContext}
    `,

    finalRequest: `
      Extract ${fieldName} for ${entityName}.

      Return JSON:
      - value: extracted value OR null
      - confidence: 0-1 (e.g., 0.95 NOT 95)
      - reasoning: why this value OR why not found
      - citations: array with sourceIndex, excerpt, confidence, date

      If confidence < 0.5, MUST return null with reasoning.
    `,
  });
}
