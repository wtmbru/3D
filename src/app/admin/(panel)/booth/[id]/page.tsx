import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProducts } from "@/lib/server/catalog";
import { getBoothSession, pastBoothItems, type BoothSuggestion } from "@/lib/server/booth";
import { BoothTracker } from "./BoothTracker";

export async function generateMetadata(props: PageProps<"/admin/booth/[id]">): Promise<Metadata> {
  const found = await getBoothSession((await props.params).id).catch(() => undefined);
  return { title: found ? found.session.name : "Booth day" };
}

export default async function BoothDayPage(props: PageProps<"/admin/booth/[id]">) {
  const { id } = await props.params;
  const found = await getBoothSession(id);
  if (!found) notFound();

  // Suggestions while adding an item: what she has sold before (with its last price and cost),
  // then her shop products (with their price; the cost is hers to fill in).
  const [past, products] = await Promise.all([pastBoothItems(), getProducts(true).catch(() => [])]);
  const known = new Set(past.map((p) => p.name.toLowerCase()));
  const suggestions: BoothSuggestion[] = [
    ...past,
    ...products.filter((p) => !known.has(p.name.toLowerCase())).map((p) => ({ name: p.name, price: p.basePrice })),
  ];

  return <BoothTracker session={found.session} initialItems={found.items} suggestions={suggestions} />;
}
