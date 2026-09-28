import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import type { Product } from "@/lib/types";
import { ProductEditor } from "../ProductEditor";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  // The id is assigned up front so uploads have a folder before the first save.
  const blank: Product = {
    id: randomUUID(),
    slug: "",
    name: "",
    tagline: "",
    description: "",
    category: "figurines",
    basePrice: 15,
    materials: ["PLA"],
    parts: [],
    presets: [],
    photos: [],
    dimensions: [0, 0, 0],
    leadTimeDays: 3,
    upAxis: "z",
    featured: false,
    published: false,
  };
  return <ProductEditor initial={blank} isNew />;
}
