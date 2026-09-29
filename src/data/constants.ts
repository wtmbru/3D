import type { Category, Finish, MaterialFamily } from "@/lib/types";

/** Most photos one product can have. */
export const MAX_PHOTOS = 12;

export const FAMILIES: MaterialFamily[] = ["PLA", "PETG", "TPU"];

export const FINISHES: Finish[] = ["basic", "matte", "silk", "translucent", "sparkle"];

export const finishLabels: Record<Finish, string> = {
  basic: "Basic",
  matte: "Matte",
  silk: "Silk",
  translucent: "Translucent",
  sparkle: "Sparkle",
};

export const categories: { id: Category; label: string; emoji: string }[] = [
  { id: "figurines", label: "Figurines", emoji: "🤖" },
  { id: "home-desk", label: "Home & Desk", emoji: "✏️" },
  { id: "planters", label: "Planters", emoji: "🪴" },
  { id: "accessories", label: "Accessories", emoji: "⭐" },
];
