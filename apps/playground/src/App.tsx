import { MDXProvider } from "@mdx-js/react";
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { CONTENT_SECTIONS, type ContentPage } from "./content";
import { Playground } from "./Playground";

const allPages = CONTENT_SECTIONS.flatMap((section) => section.pages);

type OutlineItem = { id: string; title: string; depth: 2 | 3 };

function resolveMdxHref(sourcePath: string, href?: string) {
  if (!href || !href.endsWith(".mdx")) return null;
  const segments = sourcePath.split("/").slice(0, -1);
  for (const segment of href.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join("/").replace(/\/page\.mdx$/, "")}`;
}

function MdxLink({
  page,
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a"> & { page: ContentPage }) {
  const route = resolveMdxHref(page.sourcePath, href);
  return route ? (
    <Link to={route}>{children}</Link>
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

function DocOutline({ headings }: { headings: OutlineItem[] }) {
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    if (!headings.length) return;
    const update = () => {
      let next = headings[0].id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= 130)
          next = heading.id;
      }
      setActive(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [headings]);

  if (!headings.length) return null;
  return (
    <aside className="doc-outline" aria-label="On this page">
      <p className="doc-outline-title">On this page</p>
      <nav>
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={[
              `depth-${heading.depth}`,
              active === heading.id ? "active" : "",
            ].join(" ")}
            aria-current={active === heading.id ? "location" : undefined}
          >
            {heading.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}

function ContentRoute() {
  const location = useLocation();
  const page = allPages.find(
    (candidate) => candidate.route === location.pathname,
  );
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
    if (location.hash) {
      requestAnimationFrame(() =>
        document
          .getElementById(decodeURIComponent(location.hash.slice(1)))
          ?.scrollIntoView(),
      );
    }
  }, [page?.route, location.hash]);

  if (!page) {
    return (
      <article className="content-page">
        <p className="eyebrow">Not found</p>
        <h1>Page not found</h1>
        <p>Choose documentation or a CLI example from the navigation.</p>
      </article>
    );
  }
  const Page = page.Component;
  return (
    <div className="article-layout">
      <article className="content-page" ref={articleRef}>
        <p className="content-kicker">
          {page.route.startsWith("/examples") ? "Examples" : "Documentation"}
        </p>
        <MDXProvider
          components={{
            Playground,
            a: (props) => <MdxLink {...props} page={page} />,
          }}
        >
          <Page />
        </MDXProvider>
        <footer className="article-footer"><a href={`https://github.com/moyarich/workspace-tools/edit/main/${page.sourcePath}`} target="_blank" rel="noreferrer">Edit this page ↗</a></footer>
      </article>
      <DocOutline headings={headings} />
    </div>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/docs">
          <span className="brand-icon">W</span>
          <span>Workspace Tools</span>
        </Link>
        <nav className="top-nav" aria-label="Main navigation">
          <NavLink
            to="/docs"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Docs
          </NavLink>
          <NavLink
            to="/examples"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Examples
          </NavLink>
          <a
            href="https://github.com/moyarich/workspace-tools"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>
      <div className="playground-layout">
        <aside className="sidebar" aria-label="Documentation navigation">
          {CONTENT_SECTIONS.map((section) => (
            <section key={section.id} className="sidebar-section">
              <h2>{section.label}</h2>
              <nav>
                {section.pages.map((page) => (
                  <NavLink
                    key={page.route}
                    to={page.route}
                    end
                    className={({ isActive }) => (isActive ? "active" : "")}
                  >
                    {page.title}
                  </NavLink>
                ))}
              </nav>
            </section>
          ))}
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/docs" replace />} />
            <Route path="*" element={<ContentRoute />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
