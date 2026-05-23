const URL_RE = /https?:\/\/[^\s"'<>，。！？、]+/i;

export interface ParsedSharedLink {
  rawText: string;
  url: string;
  title: string;
  category: string;
  provider: string;
  notes: string;
}

export function normalizeLinkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    while (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

interface LinkCandidate {
  rawText: string;
  url: string;
  host: string;
  urlStart: number;
}

interface SourceParser {
  id: string;
  provider: string;
  category: string;
  fallbackTitle: string;
  matchesHost: (host: string) => boolean;
  extractTitle: (candidate: LinkCandidate) => string;
  extractNotes?: (candidate: LinkCandidate) => string;
}

function cleanTitle(value: string): string {
  return value
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleBeforeUrl(candidate: LinkCandidate): string {
  return cleanTitle(candidate.rawText.slice(0, candidate.urlStart));
}

function bilibiliParts(candidate: LinkCandidate): {
  title: string;
  markers: string[];
} {
  const beforeUrl = titleBeforeUrl(candidate);
  const bilibiliMatch = beforeUrl.match(/^【([\s\S]*?)[-—_ ]*哔哩哔哩】([\s\S]*)$/i);

  if (!bilibiliMatch) {
    return {
      title: cleanTitle(beforeUrl.replace(/[-—_ ]*哔哩哔哩$/i, "")),
      markers: [],
    };
  }

  const [, rawTitle, rawMetadata] = bilibiliMatch;
  const markers = Array.from(rawMetadata.matchAll(/【([^】]+)】/g)).map(
    (match) => match[1]
  );
  return {
    title: cleanTitle(rawTitle),
    markers,
  };
}

function bilibiliTitle(candidate: LinkCandidate): string {
  return bilibiliParts(candidate).title;
}

function bilibiliNotes(candidate: LinkCandidate): string {
  const markers = bilibiliParts(candidate).markers;
  return ["Source: Bilibili", ...markers].join("\n");
}

const SOURCE_PARSERS: SourceParser[] = [
  {
    id: "xiaohongshu",
    provider: "Xiaohongshu",
    category: "GALLERY",
    fallbackTitle: "Xiaohongshu Note",
    matchesHost: (host) =>
      host === "xhslink.com" ||
      host.endsWith(".xhslink.com") ||
      host.includes("xiaohongshu.com"),
    extractTitle: titleBeforeUrl,
  },
  {
    id: "bilibili",
    provider: "Bilibili",
    category: "TUTORIAL",
    fallbackTitle: "Bilibili Link",
    matchesHost: (host) => host.includes("bilibili.com") || host === "b23.tv",
    extractTitle: bilibiliTitle,
    extractNotes: bilibiliNotes,
  },
];

function findLinkCandidate(rawText: string): LinkCandidate | null {
  const match = rawText.match(URL_RE);
  if (!match || typeof match.index !== "number") return null;
  const url = match[0];
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    host = "";
  }

  return {
    rawText,
    url,
    host,
    urlStart: match.index,
  };
}

function genericParserForHost(host: string): SourceParser {
  return {
    id: "generic",
    provider: host || "Link",
    category: "REVIEW",
    fallbackTitle: host || "Reference Link",
    matchesHost: () => true,
    extractTitle: titleBeforeUrl,
  };
}

export function parseSharedLink(text: string): ParsedSharedLink | null {
  const rawText = text.trim();
  const candidate = findLinkCandidate(rawText);
  if (!candidate) return null;

  const parser =
    SOURCE_PARSERS.find((item) => item.matchesHost(candidate.host)) ??
    genericParserForHost(candidate.host);
  const extractedTitle = parser.extractTitle(candidate);
  const title = extractedTitle || parser.fallbackTitle;
  const notes = parser.extractNotes
    ? parser.extractNotes(candidate)
    : `Source: ${parser.provider}`;

  return {
    rawText,
    url: candidate.url,
    title: title.slice(0, 200),
    category: parser.category,
    provider: parser.provider,
    notes,
  };
}
