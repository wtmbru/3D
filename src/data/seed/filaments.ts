import type { Filament, MaterialInfo } from "@/lib/types";

/**
 * Starter filament wall. Loaded into Supabase by `npm run seed`, and used as
 * the catalog when Supabase isn't configured yet.
 */
export const seedFilaments: Filament[] = [
  // PLA Basic
  { id: "pla-jade-white", name: "Jade White", family: "PLA", finish: "basic", hex: "#F4F1EA", inStock: true, surcharge: 0 },
  { id: "pla-black", name: "Classic Black", family: "PLA", finish: "basic", hex: "#232326", inStock: true, surcharge: 0 },
  { id: "pla-grey", name: "Pebble Grey", family: "PLA", finish: "basic", hex: "#8E9094", inStock: true, surcharge: 0 },
  { id: "pla-red", name: "Cherry Red", family: "PLA", finish: "basic", hex: "#D8262E", inStock: true, surcharge: 0 },
  { id: "pla-orange", name: "Tangerine", family: "PLA", finish: "basic", hex: "#FF7A1A", inStock: true, surcharge: 0 },
  { id: "pla-yellow", name: "Sunflower", family: "PLA", finish: "basic", hex: "#FFC928", inStock: true, surcharge: 0 },
  { id: "pla-green", name: "Leaf Green", family: "PLA", finish: "basic", hex: "#2FAE4E", inStock: true, surcharge: 0 },
  { id: "pla-cyan", name: "Pool Blue", family: "PLA", finish: "basic", hex: "#1FA7E0", inStock: true, surcharge: 0 },
  { id: "pla-blue", name: "Cobalt", family: "PLA", finish: "basic", hex: "#2448C9", inStock: true, surcharge: 0 },
  { id: "pla-purple", name: "Grape", family: "PLA", finish: "basic", hex: "#7B3FC4", inStock: true, surcharge: 0 },
  { id: "pla-pink", name: "Bubblegum", family: "PLA", finish: "basic", hex: "#FF6FB5", inStock: false, surcharge: 0 },
  // PLA Matte
  { id: "matte-ivory", name: "Ivory", family: "PLA", finish: "matte", hex: "#EFE6D2", inStock: true, surcharge: 1 },
  { id: "matte-charcoal", name: "Charcoal", family: "PLA", finish: "matte", hex: "#3A3A3F", inStock: true, surcharge: 1 },
  { id: "matte-sakura", name: "Sakura Pink", family: "PLA", finish: "matte", hex: "#F5B5C8", inStock: true, surcharge: 1 },
  { id: "matte-lilac", name: "Lilac", family: "PLA", finish: "matte", hex: "#B9A4E0", inStock: true, surcharge: 1 },
  { id: "matte-mint", name: "Mint", family: "PLA", finish: "matte", hex: "#9EE3C4", inStock: true, surcharge: 1 },
  { id: "matte-sky", name: "Ice Blue", family: "PLA", finish: "matte", hex: "#A7D3F2", inStock: true, surcharge: 1 },
  { id: "matte-latte", name: "Latte", family: "PLA", finish: "matte", hex: "#B08663", inStock: true, surcharge: 1 },
  { id: "matte-terracotta", name: "Terracotta", family: "PLA", finish: "matte", hex: "#C8643F", inStock: true, surcharge: 1 },
  // PLA Silk
  { id: "silk-gold", name: "Silk Gold", family: "PLA", finish: "silk", hex: "#E3B341", hex2: "#FFE7A0", inStock: true, surcharge: 2 },
  { id: "silk-silver", name: "Silk Silver", family: "PLA", finish: "silk", hex: "#B9BEC6", hex2: "#F2F4F7", inStock: true, surcharge: 2 },
  { id: "silk-rose", name: "Silk Rose Gold", family: "PLA", finish: "silk", hex: "#D99A8C", hex2: "#F7D5CB", inStock: true, surcharge: 2 },
  { id: "silk-copper", name: "Silk Copper", family: "PLA", finish: "silk", hex: "#B8683C", hex2: "#E8A77C", inStock: false, surcharge: 2 },
  { id: "sparkle-galaxy", name: "Galaxy Black", family: "PLA", finish: "sparkle", hex: "#1D1B2B", inStock: true, surcharge: 2 },
  // PETG
  { id: "petg-white", name: "PETG White", family: "PETG", finish: "basic", hex: "#F7F7F5", inStock: true, surcharge: 0 },
  { id: "petg-black", name: "PETG Black", family: "PETG", finish: "basic", hex: "#1E1E21", inStock: true, surcharge: 0 },
  { id: "petg-teal", name: "Sea Glass", family: "PETG", finish: "translucent", hex: "#3FB8AF", inStock: true, surcharge: 1 },
  { id: "petg-orange", name: "Amber Glass", family: "PETG", finish: "translucent", hex: "#FF9A2E", inStock: true, surcharge: 1 },
  // TPU
  { id: "tpu-black", name: "Flex Black", family: "TPU", finish: "matte", hex: "#28282B", inStock: true, surcharge: 0 },
  { id: "tpu-white", name: "Flex White", family: "TPU", finish: "matte", hex: "#EDEDEA", inStock: true, surcharge: 0 },
  { id: "tpu-red", name: "Flex Red", family: "TPU", finish: "matte", hex: "#D93A3A", inStock: true, surcharge: 0 },
];

export const seedMaterials: MaterialInfo[] = [
  { family: "PLA", label: "PLA", blurb: "Crisp detail, huge color range. Best for decor, figures and gifts.", surcharge: 0 },
  { family: "PETG", label: "PETG", blurb: "Tougher and water-friendly. Great for planters and anything outdoors.", surcharge: 3 },
  { family: "TPU", label: "TPU (flexible)", blurb: "Soft and bendy. Perfect for charms, straps and squishy things.", surcharge: 5 },
];
