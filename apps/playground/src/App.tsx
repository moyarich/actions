import { MDXProvider } from "@mdx-js/react";
import { DynamicIcon } from "lucide-react/dynamic";
import {
  useEffect,
  useMemo,
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
import { Playground, MonacoCodeGroup } from "./components/Playground";
import { CodeGroup, CodeTab } from "./components/CodeGroup";
import { DocOutline, type OutlineItem } from "./components/DocOutline";
import { DocsLayout } from "./components/DocsLayout";

const allPages = CONTENT_SECTIONS.flatMap((section) => section.pages);


function resolveMdxHref(page: ContentPage, href?: string) {
  if (!href) return null;
  // HashRouter owns the fragment. A plain #heading would replace the whole route.
  if (href.startsWith("#")) return `${page.route}${href}`;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return null;

  const [path, fragment = ""] = href.split("#", 2);
  if (!path || !/\.(?:md|mdx)$/.test(path)) return null;

  const parts = path.startsWith("/")
    ? []
    : page.sourcePath.split("/").slice(0, -1);
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const sourcePath = parts.join("/");
  const match = allPages.find(
    (candidate) => candidate.sourcePath === sourcePath,
  );
  // Ordinary Markdown files aren't compiled as playground routes.
  if (!match) {
    // Render source-only Markdown links on GitHub instead of navigating to a
    // missing GitHub Pages file under the Vite application base path.
    return `https://github.com/moyarich/workspace-tools/blob/main/${sourcePath}${fragment ? `#${fragment}` : ""}`;
  }
  return `${match.route}${fragment ? `#${fragment}` : ""}`;
}

function MdxLink({
  page,
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a"> & { page: ContentPage }) {
  const route = resolveMdxHref(page, href);
  return route?.startsWith("/") ? (
    <Link to={route} {...props}>
      {children}
    </Link>
  ) : (
    <a href={route ?? href} {...props}>
      {children}
    </a>
  );
}

function ContentRoute() {
  const location = useLocation();
  const page = allPages.find(
    (candidate) => candidate.route === location.pathname,
  );
  const articleRef = useRef<HTMLElement>(null);
  const [headings, setHeadings] = useState<OutlineItem[]>([]);
  const mdxComponents = useMemo(
    () => ({
      Playground,
      Icon: DynamicIcon,
      MonacoCodeGroup,
      CodeGroup,
      CodeTab,
      a: (props: ComponentPropsWithoutRef<"a">) =>
        page ? <MdxLink {...props} page={page} /> : <a {...props} />,
    }),
    [page],
  );

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
  }, [page?.route]);

  useEffect(() => {
    if (!location.hash) return;
    let targetId: string;
    try {
      targetId = decodeURIComponent(location.hash.slice(1));
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
    <DocsLayout
      toc={headings.length > 0 ? <DocOutline headings={headings} /> : undefined}
    >
      <article className="content-page" ref={articleRef}>
        <p className="content-kicker">
          {page.route.startsWith("/examples") ? "Examples" : "Documentation"}
        </p>
        <MDXProvider components={mdxComponents}>
          <Page />
        </MDXProvider>
        <footer className="article-footer">
          <a
            href={`https://github.com/moyarich/workspace-tools/edit/main/${page.sourcePath}`}
            target="_blank"
            rel="noreferrer"
          >
            Edit this page ↗
          </a>
        </footer>
      </article>
    </DocsLayout>
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
