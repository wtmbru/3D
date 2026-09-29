import Image from "next/image";
import mark from "@/assets/brand/mark.png";
import { site } from "@/config/site";

/**
 * The Filamint icon plus the name set in the site font. The name is text, not
 * part of the image, so it stays sharp and takes the surrounding text color
 * (light on the dark footer, dark on cream). Use `logo.png` from
 * src/assets/brand where the full lockup is wanted (e.g. print, social).
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image src={mark} alt="" sizes="44px" className="h-10 w-auto shrink-0" />
      <span className="font-display text-xl font-extrabold tracking-tight">{site.name}</span>
    </span>
  );
}
