import type { APIRoute } from "astro";
import { markdownResponse, PRICING_MARKDOWN } from "../agent-content";

export const GET: APIRoute = ({ request }) =>
  markdownResponse(PRICING_MARKDOWN, request.method);
