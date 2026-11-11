export type FaqItem = {
  question: string;
  answer: string;
};

/** FAQ answers can carry `code`, **bold** and [links](/path/); structured data wants plain text. */
function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replaceAll("**", "")
    .replaceAll("`", "");
}

export function faqPageSchema(faq: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: plainText(item.question),
      acceptedAnswer: {
        "@type": "Answer",
        text: plainText(item.answer),
      },
    })),
  };
}
