import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";

import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Prompts: each workflow prompt's success, missing and invalid arguments, and an unknown name. */
export const PROMPT_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            messages: [
              {
                content: {
                  text: "Find Nakafa learning content for: persamaan linear\nPreferred locale: id\nUse `nakafa_search_content`, inspect returned summaries, then cite the best canonical URL.",
                  type: "text",
                },
                role: "user",
              },
            ],
            resultType: "complete",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 41,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get renders the find-lesson prompt for a chosen locale",
    request: modernPost(
      41,
      "prompts/get",
      {
        arguments: { locale: "id", topic: "persamaan linear" },
        name: "nakafa_find_lesson",
      },
      "nakafa_find_lesson"
    ),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            messages: [
              {
                content: {
                  text: "Answer this question from Nakafa content: What is the key idea?\nContent reference: https://nakafa.com/en/articles/math/algebra\nUse `nakafa_get_content`, answer only from the returned Markdown, and cite the canonical URL.",
                  type: "text",
                },
                role: "user",
              },
            ],
            resultType: "complete",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 15,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get renders the answer-from-content prompt for one reference",
    request: modernPost(
      15,
      "prompts/get",
      {
        arguments: {
          content_ref: "https://nakafa.com/en/articles/math/algebra",
          question: "What is the key idea?",
        },
        name: "nakafa_answer_from_content",
      },
      "nakafa_answer_from_content"
    ),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            messages: [
              {
                content: {
                  text: "Retrieve Quran reference Surah 1, verses 1-7.\nLocale: id\nQuestion: Apa pesan ayat ini?\nUse `nakafa_get_quran_reference` and cite the canonical Nakafa URL.",
                  type: "text",
                },
                role: "user",
              },
            ],
            resultType: "complete",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 16,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get renders the Quran reference prompt for a verse range",
    request: modernPost(
      16,
      "prompts/get",
      {
        arguments: {
          from_verse: "1",
          locale: "id",
          question: "Apa pesan ayat ini?",
          surah: "1",
          to_verse: "7",
        },
        name: "nakafa_quran_reference",
      },
      "nakafa_quran_reference"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 42,
          error: {
            code: -32_602,
            message:
              "Invalid arguments for prompt nakafa_find_lesson: data must have required property 'topic'",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects a find-lesson call without a topic",
    request: modernPost(
      42,
      "prompts/get",
      { arguments: { locale: "en" }, name: "nakafa_find_lesson" },
      "nakafa_find_lesson"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 43,
          error: {
            code: -32_602,
            message:
              "Invalid arguments for prompt nakafa_answer_from_content: data must have required property 'question'",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects an answer-from-content call without a question",
    request: modernPost(
      43,
      "prompts/get",
      {
        arguments: {
          content_ref: "https://nakafa.com/en/articles/math/algebra",
        },
        name: "nakafa_answer_from_content",
      },
      "nakafa_answer_from_content"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 44,
          error: {
            code: -32_602,
            message:
              "Invalid arguments for prompt nakafa_quran_reference: data must have required property 'surah'",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects a Quran reference call without a surah",
    request: modernPost(
      44,
      "prompts/get",
      {
        arguments: { from_verse: "1", locale: "en" },
        name: "nakafa_quran_reference",
      },
      "nakafa_quran_reference"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 17,
          error: {
            code: -32_602,
            message:
              'Invalid arguments for prompt nakafa_find_lesson: Expected a value with a length of at least 1\n  at ["topic"]',
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects an empty find-lesson topic",
    request: modernPost(
      17,
      "prompts/get",
      { arguments: { topic: "" }, name: "nakafa_find_lesson" },
      "nakafa_find_lesson"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 45,
          error: {
            code: -32_602,
            message:
              "Invalid arguments for prompt nakafa_quran_reference: data/locale must be equal to one of the allowed values, data/locale must be null, data/locale must match a schema in anyOf",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects an unsupported locale in the Quran reference prompt",
    request: modernPost(
      45,
      "prompts/get",
      {
        arguments: { locale: "fr", surah: "1" },
        name: "nakafa_quran_reference",
      },
      "nakafa_quran_reference"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 46,
          error: {
            code: -32_602,
            message:
              'Invalid arguments for prompt nakafa_answer_from_content: Expected a Nakafa graph content ID, resource URI, or canonical URL.\n  at ["content_ref"]',
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects an answer-from-content reference that is not a Nakafa reference",
    request: modernPost(
      46,
      "prompts/get",
      {
        arguments: {
          content_ref: "not-a-reference",
          question: "What is the key idea?",
        },
        name: "nakafa_answer_from_content",
      },
      "nakafa_answer_from_content"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 47,
          error: {
            code: -32_602,
            message: "Prompt nakafa_unknown_prompt not found",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/get rejects an unknown prompt name",
    request: modernPost(
      47,
      "prompts/get",
      { arguments: {}, name: "nakafa_unknown_prompt" },
      "nakafa_unknown_prompt"
    ),
  },
];
