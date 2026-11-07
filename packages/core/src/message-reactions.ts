import type { MessageBlock, MessageReaction } from "@rakazo/contracts";
import { MessageReactionSchema } from "@rakazo/contracts";

type ReactionMessage = {
  id: string;
  role: string;
  blocks: MessageBlock[];
  replyToMessageId?: string | null;
};

/** Emoji-only user or bot replies are conversation messages displayed compactly beneath their target. */
export function messageReaction(
  message: Pick<ReactionMessage, "role" | "blocks" | "replyToMessageId">,
): MessageReaction | null {
  if (
    (message.role !== "user" && message.role !== "bot") ||
    !message.replyToMessageId ||
    message.blocks.length !== 1
  )
    return null;
  const block = message.blocks[0];
  return block?.kind === "text" ? (MessageReactionSchema.safeParse(block.text).data ?? null) : null;
}

/**
 * Detects whether an incoming user message expresses sentiment that warrants an immediate bot reaction
 * (e.g. 👍 for 'good', 'great', praise; ❤️ for 'I love you', affection; 🎉 for celebration; 😂 for laughter).
 * Returns the matching emoji reaction or null if no automatic reaction applies.
 */
export function detectMessageReaction(text: string | null | undefined): MessageReaction | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  // Negative guards (e.g. "not good", "no good", "don't love", "not nice", etc.)
  if (
    /\b(not|no|isn't|isnt|aren't|arent|never|barely|hardly)\s+(good|great|nice|cool|awesome|perfect)\b/i.test(
      lower,
    )
  ) {
    return null;
  }
  if (/\b(not|don't|dont|never)\s+(love|like)\b/i.test(lower)) {
    return null;
  }

  // Affection / Love (❤️)
  if (
    /\b(i\s+love\s+(you|u)|love\s+(you|u)|ily|love\s+ya|luv\s+u|love\s+this|adore\s+you)\b/i.test(lower) ||
    lower === "<3" ||
    lower === "❤️" ||
    lower === "💖" ||
    lower === "💕"
  ) {
    return "❤️";
  }

  // Praise / Like / Agreement (👍)
  if (
    /^(good|great|nice|cool|awesome|perfect|excellent|well done|good job|superb|bravo|yay|thanks|thank you|thx|ty|ok|okay)[!.]*$/i.test(
      lower,
    ) ||
    /\b(good\s+job|well\s+done|great\s+job|nice\s+work|awesome\s+work|perfect)\b/i.test(lower) ||
    /^(looks\s+good|sounds\s+good|that's\s+good|thats\s+good|so\s+good|very\s+good)[!.]*$/i.test(lower)
  ) {
    return "👍";
  }

  // Celebration (🎉)
  if (/\b(congrats|congratulations|cheers|happy\s+birthday|celebrate|hooray)\b/i.test(lower)) {
    return "🎉";
  }

  // Laughter (😂)
  if (/^(ha(ha)+|he(he)+|lmao+|lol+|rofl+|haha|hehe)[!.]*$/i.test(lower)) {
    return "😂";
  }

  return null;
}

export function projectMessageReactions<Message extends ReactionMessage>(
  messages: readonly Message[],
) {
  const parents = new Map(messages.map((message) => [message.id, message]));
  const reactions = new Map<string, Map<MessageReaction, number>>();
  const visibleMessages = messages.filter((message) => {
    const emoji = messageReaction(message);
    const parentId = message.replyToMessageId;
    const parent = parentId ? parents.get(parentId) : undefined;
    // Keep an ordinary reply bubble when the parent is outside the loaded page, so it can be opened.
    if (!emoji || !parentId || !parent || messageReaction(parent) || parentId === message.id)
      return true;
    const counts = reactions.get(parentId) ?? new Map<MessageReaction, number>();
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
    reactions.set(parentId, counts);
    return false;
  });
  return { visibleMessages, reactions };
}
