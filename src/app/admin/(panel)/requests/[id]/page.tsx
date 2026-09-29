import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requestLabel } from "@/lib/requests";
import { getRequestById } from "@/lib/server/requests";
import { RequestDetail } from "./RequestDetail";

export async function generateMetadata(props: PageProps<"/admin/requests/[id]">): Promise<Metadata> {
  const r = await getRequestById((await props.params).id);
  return { title: r ? `Request ${requestLabel(r.number)}` : "Request" };
}

export default async function RequestPage(props: PageProps<"/admin/requests/[id]">) {
  const { id } = await props.params;
  const request = await getRequestById(id);
  if (!request) notFound();
  return <RequestDetail request={request} />;
}
