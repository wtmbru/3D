import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductById } from "@/lib/server/catalog";
import { ProductEditor } from "../ProductEditor";

export async function generateMetadata(props: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const product = await getProductById((await props.params).id);
  return { title: product?.name ?? "Product" };
}

export default async function EditProductPage(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const product = await getProductById(id);
  if (!product) notFound();
  return <ProductEditor key={product.id} initial={product} isNew={false} />;
}
