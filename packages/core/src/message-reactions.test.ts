import type { MessageBlock } from "@forion/orbit-contracts";
import { describe, expect, it } from "vitest";
import {
  detectMessageReaction,
  messageReaction,
  projectMessageReactions,
} from "./message-reactions.js";

const message = (id: string, text: string, replyToMessageId?: string, role = "user") => ({
  id,
  role,
  blocks: [{ kind: "text", text }] as MessageBlock[],
  replyToMessageId,
});

describe("reaction conversation presentation", () => {
  it("keeps distinct and repeated reactions without replacing earlier messages", () => {
    const parent = message("parent", "Hello");
    const messages = [
      parent,
      message("one", "❤️", parent.id),
      message("two", "👍", parent.id),
      message("three", "❤️", parent.id, "bot"),
    ];
    const result = projectMessageReactions(messages);
    expect(result.visibleMessages).toEqual([parent]);
    expect([...result.reactions.get(parent.id)!]).toEqual([
      ["❤️", 2],
      ["👍", 1],
    ]);
    expect(messages).toHaveLength(4);
  });
  it("keeps replies visible when their parent is outside the loaded page", () => {
    const reply = message("reply", "❤️", "old-parent");
    expect(projectMessageReactions([reply]).visibleMessages).toEqual([reply]);
  });
  it("does not collapse ordinary replies or standalone emoji, but collapses user and bot single-emoji replies", () => {
    expect(messageReaction(message("one", "❤️"))).toBeNull();
    expect(messageReaction(message("two", "❤️ thank you", "parent"))).toBeNull();
    expect(messageReaction({ ...message("three", "❤️", "parent"), role: "bot" })).toBe("❤️");
    expect(messageReaction({ ...message("four", "👍", "parent"), role: "user" })).toBe("👍");
    expect(messageReaction({ ...message("five", "❤️", "parent"), role: "system" })).toBeNull();
  });
});

describe("detectMessageReaction", () => {
  it("detects like (👍) on praise and agreement", () => {
    expect(detectMessageReaction("good")).toBe("👍");
    expect(detectMessageReaction("Good!")).toBe("👍");
    expect(detectMessageReaction("great")).toBe("👍");
    expect(detectMessageReaction("nice")).toBe("👍");
    expect(detectMessageReaction("good job")).toBe("👍");
    expect(detectMessageReaction("well done")).toBe("👍");
    expect(detectMessageReaction("perfect")).toBe("👍");
    expect(detectMessageReaction("awesome")).toBe("👍");
    expect(detectMessageReaction("thanks")).toBe("👍");
    expect(detectMessageReaction("looks good")).toBe("👍");
  });

  it("detects heart (❤️) on affection and love", () => {
    expect(detectMessageReaction("i love you")).toBe("❤️");
    expect(detectMessageReaction("I love you!")).toBe("❤️");
    expect(detectMessageReaction("love you")).toBe("❤️");
    expect(detectMessageReaction("ily")).toBe("❤️");
    expect(detectMessageReaction("love u")).toBe("❤️");
    expect(detectMessageReaction("❤️")).toBe("❤️");
    expect(detectMessageReaction("<3")).toBe("❤️");
  });

  it("detects celebration (🎉) and laughter (😂)", () => {
    expect(detectMessageReaction("congrats")).toBe("🎉");
    expect(detectMessageReaction("congratulations!")).toBe("🎉");
    expect(detectMessageReaction("haha")).toBe("😂");
    expect(detectMessageReaction("hahahaha")).toBe("😂");
    expect(detectMessageReaction("lol")).toBe("😂");
  });

  it("respects negative guards and ignores negative feedback", () => {
    expect(detectMessageReaction("not good")).toBeNull();
    expect(detectMessageReaction("no good")).toBeNull();
    expect(detectMessageReaction("isn't good")).toBeNull();
    expect(detectMessageReaction("not great")).toBeNull();
    expect(detectMessageReaction("i don't love this")).toBeNull();
    expect(detectMessageReaction("")).toBeNull();
    expect(detectMessageReaction(null)).toBeNull();
  });
});
