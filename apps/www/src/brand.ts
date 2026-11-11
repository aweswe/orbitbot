export const BRAND_KIT_PATH = "/brand/";
export const WORDMARK_SVG_PATH = "/brand/kit/orbit-wordmark.svg";

export const BRAND_LOGOS = [
  {
    name: "Mark",
    file: "/brand/kit/orbit-logo.png",
    preview: "/brand/kit/orbit-logo.png",
    format: "PNG · 512 × 512",
  },
  {
    name: "Wordmark",
    file: WORDMARK_SVG_PATH,
    preview: WORDMARK_SVG_PATH,
    format: "SVG",
  },
  {
    name: "App icon",
    file: "/brand/kit/orbit-icon.png",
    preview: "/brand/kit/orbit-icon.png",
    format: "PNG · 512 × 512",
  },
] as const;

export const BRAND_COLORS = [
  { name: "Cyan", hex: "#22D3EE" },
  { name: "Violet", hex: "#7C3AED" },
  { name: "Ink", hex: "#050508" },
  { name: "White", hex: "#FFFFFF" },
] as const;
