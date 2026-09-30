import { ImageResponse } from "next/og";
import { site } from "@/config/site";
import { formatPrice, getFilament } from "@/lib/pricing";
import { getCatalog, getProductBySlug } from "@/lib/server/catalog";

// The picture shown when a product link is shared: its photo (or its colors) on a Filamint card.
export const alt = `${site.name} product`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The photo as an embedded image. ImageResponse can't read WebP, so those are converted; anything unreadable is skipped. */
async function photoData(url: string | undefined): Promise<string | undefined> {
  if (!url || !/^https:\/\//.test(url)) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return undefined;
    let type = res.headers.get("content-type")?.split(";")[0] ?? "";
    let bytes: Buffer = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 8_000_000) return undefined;
    if (type === "image/webp") {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(bytes).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      type = "image/jpeg";
    }
    if (!["image/png", "image/jpeg", "image/gif"].includes(type)) return undefined;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let name: string = site.name;
  let tagline: string = site.tagline;
  let price: string | undefined;
  let photo: string | undefined;
  let dots: string[] = [];

  try {
    const [product, catalog] = await Promise.all([getProductBySlug(slug), getCatalog()]);
    if (product) {
      name = product.name;
      tagline = product.tagline;
      price = `From ${formatPrice(product.basePrice)}`;
      photo = await photoData(product.photos?.[0]);
      const preset = product.presets[0];
      dots = [...new Set(Object.values(preset?.colors ?? {}).map((id) => getFilament(catalog, id)?.hex).filter((h): h is string => !!h))].slice(0, 4);
    }
  } catch {
    // A shared link must still get a picture if the database hiccups: fall back to the plain brand card.
  }

  const ink = "#1f1640";
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff6ea", padding: 36 }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            border: `6px solid ${ink}`,
            borderRadius: 40,
            background: "#ffffff",
            boxShadow: `12px 12px 0 ${ink}`,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: 52, color: ink }}>
            <div style={{ display: "flex", fontSize: 34, letterSpacing: 4, textTransform: "uppercase", color: "#5b527a" }}>{site.name}</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: name.length > 22 ? 62 : 78, lineHeight: 1.05, fontWeight: 700 }}>{name}</div>
              <div style={{ display: "flex", marginTop: 20, fontSize: 32, lineHeight: 1.3, color: "#5b527a" }}>{tagline.slice(0, 90)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {price && (
                <div style={{ display: "flex", background: "#ffc53d", border: `4px solid ${ink}`, borderRadius: 999, padding: "10px 30px", fontSize: 38, fontWeight: 700 }}>
                  {price}
                </div>
              )}
              <div style={{ display: "flex", fontSize: 28, color: "#5b527a" }}>Pick your colors</div>
            </div>
          </div>
          <div style={{ display: "flex", width: 470, alignItems: "center", justifyContent: "center", background: "#ffdcee", borderLeft: `6px solid ${ink}` }}>
            {photo ? (
              <img src={photo} width={470} height={618} style={{ objectFit: "cover" }} alt="" />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", width: 340, justifyContent: "center", gap: 24 }}>
                {(dots.length ? dots : ["#ff5e3a", "#ffc53d", "#2ed3a0", "#4f8bff"]).map((hex, i) => (
                  <div key={i} style={{ display: "flex", width: 150, height: 150, borderRadius: 999, background: hex, border: `6px solid ${ink}` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
