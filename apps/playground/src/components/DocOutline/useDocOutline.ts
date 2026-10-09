import { useEffect, useRef, useState } from "react";
import type { OutlineItem } from "./DocOutline";

/** Collect page headings and navigate hash fragments without remounting MDX. */
export function useDocOutline(pageKey: string | undefined, hash: string) {
  const articleRef = useRef<HTMLElement>(null);
  const [headings, setHeadings] = useState<OutlineItem[]>([]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const used = new Map<string, number>();
    const entries: OutlineItem[] = Array.from(
      article.querySelectorAll<HTMLHeadingElement>("h2, h3"),
    )
      .map((element) => {
        const title = element.textContent?.trim() ?? "";
        if (!title) return null;
        const base =
          element.id ||
          title
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-") ||
          "section";
        const seen = used.get(base) ?? 0;
        used.set(base, seen + 1);
        const id = seen ? `${base}-${seen + 1}` : base;
        element.id = id;
        return {
          id,
          title,
          depth: element.tagName === "H2" ? 2 : 3,
        } as OutlineItem;
      })
      .filter((entry): entry is OutlineItem => entry !== null);
    setHeadings(entries);
  }, [pageKey]);

  useEffect(() => {
    if (!hash) return;
    let targetId: string;
    try {
      targetId = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pageKey, hash]);

  return { articleRef, headings };
}
