import type { IdentityLabels } from "@forion/orbit-core";
import { t } from "./i18n";

export function identityLabels(): IdentityLabels {
  return {
    bot: t("Bot"),
    group: t("Group"),
    space: t("Space"),
    chats: t("Chats"),
    routine: t("Routine"),
    member: t("Member"),
    subagent: t("subagent"),
    owner: t("Owner"),
  };
}
