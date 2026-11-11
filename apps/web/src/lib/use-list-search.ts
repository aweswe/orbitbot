import type { ListSearchOptions } from "@forion/orbit-core";
import { listSearch } from "@forion/orbit-core";
import { useState } from "react";

export function useListSearch<T>(items: readonly T[], options: ListSearchOptions<T>) {
  const [query, setQuery] = useState("");
  return { query, setQuery, ...listSearch(items, query, options) };
}
