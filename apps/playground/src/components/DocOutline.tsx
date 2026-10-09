import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./DocOutline.css";

export type OutlineItem = { id: string; title: string; depth: 2 | 3 };

export function DocOutline({ headings }: { headings: OutlineItem[] }) {
  const location = useLocation();
  const [active, setActive] = useState<string>("");
  const scrollingTo = useRef<string | null>(null);
  useEffect(() => {
    if (!headings.length) return;
    const update = () => {
      if (scrollingTo.current) return;
      let next = headings[0].id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= 130)
          next = heading.id;
      }
      // The final heading may never reach the top threshold on short pages.
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 3;
      if (atBottom) next = headings[headings.length - 1].id;
      setActive(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const finishScroll = () => {
      scrollingTo.current = null;
      update();
    };
    window.addEventListener("scrollend", finishScroll);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scrollend", finishScroll);
    };
  }, [headings]);

  if (!headings.length) return null;
  return (
    <aside className="doc-outline" aria-label="On this page">
      <p className="doc-outline-title">On this page</p>
      <nav>
        {headings.map((heading) => (
          <Link
            key={heading.id}
            to={`${location.pathname}#${heading.id}`}
            onClick={() => {
              scrollingTo.current = heading.id;
              setActive(heading.id);
            }}
            className={[
              `depth-${heading.depth}`,
              active === heading.id ? "active" : "",
            ].join(" ")}
            aria-current={active === heading.id ? "location" : undefined}
          >
            {heading.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

