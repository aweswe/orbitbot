import { BRAND_COLORS, BRAND_LOGOS } from "./brand";
import {
  APP_URL,
  DOCS_URL,
  GITHUB_URL,
  IOS_APP_URL,
  SITE_URL,
} from "./site";
// Relative source path: the edge middleware bundles this file and cannot resolve workspace packages.
import { ANDROID_APP_STORE_URL } from "../../../packages/contracts/src/client-build.js";

export const AGENT_DISCOVERY_LINKS =
  '</llms.txt>; rel="describedby"; type="text/plain", </.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/ai-catalog+json"';

export const HOME_MARKDOWN = `# Orbit Bot

Orbit Bot is an Orbit product powered by Forion. It gives autonomous agents persistent Linux computers with a browser, shell, files, and a desktop, so they can finish work across multiple steps.

## What Orbit does

- **Persistent computers:** each bot keeps its own files, browser, and workspace between tasks.
- **Real tools:** read and write files, run commands, browse the web, and connect MCP tools.
- **Multi-agent teams:** group chats, handoffs, and subagents let bots divide work and stay in sync.
- **Routines and triggers:** scheduled tasks and webhooks start work without waiting for a prompt.
- **Approvals you control:** pause before consequential actions, approve once or always, or take over.
- **Web, desktop, and mobile:** the same workspace is available in a browser, the Electron app, and the Expo app.

## Get started

- [Open Orbit](${APP_URL})
- [Download Orbit](${SITE_URL}/download/)
- [Read the docs](${DOCS_URL})
- [Pricing](${SITE_URL}/pricing/)
- [About Orbit Bot](${SITE_URL}/about/)
- [Source code](${GITHUB_URL})

Orbit Bot is a derivative of the Rakazo project and is distributed under the Apache License 2.0. See the repository's ATTRIBUTION.md for details.
`;

export const ABOUT_MARKDOWN = `# About Orbit Bot

Orbit Bot is an Orbit product built by Forion. Orbit is the customer-facing product family; Forion is the company and the underlying platform.

Orbit Bot gives autonomous agents a durable place to work: a Linux computer with a browser, shell, files, and a desktop, plus routines, approvals, and multi-agent collaboration. It runs on the web, as an Electron desktop app, and as an Expo mobile app.

The source is available under the Apache License 2.0. Orbit Bot is a derivative of the Rakazo project; see the repository's ATTRIBUTION.md for upstream attribution.

- [Source code](${GITHUB_URL})
- [Documentation](${DOCS_URL})
- [Support](${SITE_URL}/support/)
`;

export const DOWNLOAD_MARKDOWN = `# Download Orbit

- [Desktop and mobile downloads](${SITE_URL}/download/)
- [iPhone](${IOS_APP_URL})
- [Android](${ANDROID_APP_STORE_URL})
- [Web](${APP_URL})

The desktop and mobile apps connect to the same Orbit workspace as the web app.
`;

export const PRICING_MARKDOWN = `# Orbit pricing

Plans, model credits, and computer hours are shown in the Orbit app, where they are tied to your
Forion account.

- [Open Orbit](${APP_URL})
- [Download Orbit](${SITE_URL}/download/)
- [Documentation](${DOCS_URL})
- [About Orbit Bot](${SITE_URL}/about/)
`;

export const SUPPORT_MARKDOWN = `# Orbit support

For help with Orbit, email [hello@forion.dev](mailto:hello@forion.dev). Include the email address on the account, what you expected to happen, and any error message you saw. Never send passwords, API keys, access tokens, or other secrets.

- [Documentation](${DOCS_URL})
- [Report a reproducible bug or request a feature](${GITHUB_URL}/issues)
- [Report a vulnerability](mailto:security@forion.dev)

Hosted users can permanently delete their account and associated personal Space data from the Account screen in the Orbit apps. Without access to the app, email [hello@forion.dev](mailto:hello@forion.dev) from the account's email address to ask us to delete it.
`;

export const PRIVACY_MARKDOWN = `# Orbit privacy

Read the full privacy policy at [${SITE_URL}/privacy/](${SITE_URL}/privacy/).

Orbit processes account details, user-provided bot content, connection information, and technical records needed to operate and secure the service. It does not sell personal information or use Orbit content for third-party advertising. Self-hosted deployments are controlled by their operator.

For privacy requests, email [hello@forion.dev](mailto:hello@forion.dev).
`;

export const TERMS_MARKDOWN = `# Orbit terms

Read the full terms at [${SITE_URL}/terms/](${SITE_URL}/terms/).

The Orbit Bot source code is governed by the Apache License 2.0, which does not grant rights to project names or logos. Self-hosted deployments are the operator's responsibility.

For questions about these terms, email [hello@forion.dev](mailto:hello@forion.dev).
`;

export const AGENT_INSTRUCTIONS = `# Orbit Bot

> An Orbit product powered by Forion. Autonomous agents with persistent computers, real tools, and multi-agent workspaces.

## What Orbit Bot is

Orbit Bot is a harness for long-running AI agents. Each bot gets a persistent Linux computer with a browser, shell, files, and a desktop. Bots can run scheduled routines, respond to webhooks, work in groups, hand off tasks to subagents, and pause for human approval before consequential actions. The product is available on the web, as a desktop app, and on mobile.

Orbit Bot is a derivative of the Rakazo project and is distributed under the Apache License 2.0. Orbit is the customer-facing product identity; Forion is the company and platform.

## Canonical resources

- [Website](${SITE_URL}/)
- [Website Markdown](${SITE_URL}/index.md)
- [Documentation](${DOCS_URL})
- [Download](${SITE_URL}/download/)
- [Pricing](${SITE_URL}/pricing/)
- [About](${SITE_URL}/about/)
- [Brand](${SITE_URL}/brand/)
- [Support](${SITE_URL}/support/)
- [Privacy](${SITE_URL}/privacy/)
- [Terms](${SITE_URL}/terms/)
- [Source](${GITHUB_URL})
- [AI Catalog](${SITE_URL}/.well-known/ai-catalog.json)
- [Sitemap](${SITE_URL}/sitemap-index.xml)

## Safety

Do not send model keys, passwords, tokens, browser sessions, or private user data to the public website or repository. Report vulnerabilities only to [security@forion.dev](mailto:security@forion.dev).
`;

export const BRAND_MARKDOWN = `# Orbit brand

Logos and colors for writing about Orbit by Forion.

## Logos

${BRAND_LOGOS.map((logo) => `- [${logo.name}](${SITE_URL}${logo.file}): ${logo.format}`).join("\n")}

## Colors

${BRAND_COLORS.map((color) => `- ${color.name}: \`${color.hex}\``).join("\n")}

## Usage

Write Orbit with a capital O in text. Do not alter the mark or imply an endorsement.

For press, email hello@forion.dev.
`;

export const NOT_FOUND_MARKDOWN = `# Page not found

The requested Orbit page does not exist.

- [Agent instructions](${SITE_URL}/llms.txt)
- [Site map](${SITE_URL}/sitemap-index.xml)
- [Home](${SITE_URL}/)
- [Documentation](${DOCS_URL})
`;

const MARKDOWN_DOCUMENTS = new Map<string, string>([
  ["/", HOME_MARKDOWN],
  ["/about", ABOUT_MARKDOWN],
  ["/brand", BRAND_MARKDOWN],
  ["/download", DOWNLOAD_MARKDOWN],
  ["/pricing", PRICING_MARKDOWN],
  ["/privacy", PRIVACY_MARKDOWN],
  ["/support", SUPPORT_MARKDOWN],
  ["/terms", TERMS_MARKDOWN],
]);

type MediaPreference = {
  quality: number;
  specificity: number;
};

export type Representation = "html" | "markdown" | "not-acceptable";

function normalizePathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function preferenceFor(accept: string, desiredType: string): MediaPreference {
  const [desiredMajor, desiredMinor] = desiredType.split("/");
  let best: MediaPreference = { quality: 0, specificity: -1 };

  for (const rawRange of accept.split(",")) {
    const [rawType = "", ...rawParameters] = rawRange
      .trim()
      .toLowerCase()
      .split(";");
    const [major, minor] = rawType.trim().split("/");
    if (!major || !minor) continue;

    const specificity =
      major === desiredMajor && minor === desiredMinor
        ? 2
        : major === desiredMajor && minor === "*"
          ? 1
          : major === "*" && minor === "*"
            ? 0
            : -1;
    if (specificity < 0) continue;

    const qualityParameter = rawParameters.find((parameter) =>
      parameter.trim().startsWith("q="),
    );
    const parsedQuality = qualityParameter
      ? Number.parseFloat(qualityParameter.trim().slice(2))
      : 1;
    const quality =
      Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1
        ? parsedQuality
        : 0;

    if (
      specificity > best.specificity ||
      (specificity === best.specificity && quality > best.quality)
    ) {
      best = { quality, specificity };
    }
  }

  return best;
}

export function negotiateRepresentation(
  acceptHeader: string | null,
): Representation {
  if (!acceptHeader?.trim()) return "html";

  const markdown = preferenceFor(acceptHeader, "text/markdown");
  const html = preferenceFor(acceptHeader, "text/html");

  if (markdown.quality <= 0 && html.quality <= 0) return "not-acceptable";
  if (markdown.quality > html.quality) return "markdown";
  if (
    markdown.quality === html.quality &&
    markdown.specificity > html.specificity
  )
    return "markdown";
  return "html";
}

export function getMarkdownDocument(pathname: string): string | undefined {
  return MARKDOWN_DOCUMENTS.get(normalizePathname(pathname));
}

export function getMarkdownAlternate(pathname: string): string | undefined {
  const normalizedPathname = normalizePathname(pathname);
  if (!MARKDOWN_DOCUMENTS.has(normalizedPathname)) return undefined;
  return normalizedPathname === "/" ? "/index.md" : `${normalizedPathname}.md`;
}

export function markdownResponse(
  body: string,
  method = "GET",
  status = 200,
): Response {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Language": "en",
      "Content-Type": "text/markdown; charset=utf-8",
      Link: AGENT_DISCOVERY_LINKS,
      Vary: "Accept, Accept-Encoding",
      ...(status === 404 ? { "X-Robots-Tag": "noindex" } : {}),
    },
  });
}
