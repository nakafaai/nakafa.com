export const LLMS_TEXT_PATH = "/llms.txt";
export const AGENT_DISCOVERY_LINK_HEADER = `<${LLMS_TEXT_PATH}>; rel="llms-txt"`;

export const AGENT_DISCOVERY_HEADERS = [
  {
    key: "Link",
    value: AGENT_DISCOVERY_LINK_HEADER,
  },
  {
    key: "X-Llms-Txt",
    value: LLMS_TEXT_PATH,
  },
] as const;
