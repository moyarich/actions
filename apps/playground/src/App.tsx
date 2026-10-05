import { MDXProvider } from "@mdx-js/react";
import type { ComponentPropsWithoutRef } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CONTENT_SECTIONS, type ContentPage } from "./content";
import { WorkflowExample } from "./WorkflowExample";

const allPages = CONTENT_SECTIONS.flatMap((section) => section.pages);

function resolveMdxHref(sourcePath: string, href?: string) {
  if (!href || !href.endsWith(".mdx")) {
    return null;
  }

  const segments = sourcePath.split("/").slice(0, -1);

  for (const segment of href.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
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

function ContentRoute() {
  const location = useLocation();
  const page = allPages.find(
    (candidate) => candidate.route === location.pathname,
  );

  if (!page) {
    return (
      <article className="content-page">
        <p className="eyebrow">Not found</p>
        <h1>Page not found</h1>
        <p>
          Choose documentation or a real workflow usage from the navigation.
        </p>
      </article>
    );
  }

  const Page = page.Component;

  return (
    <article className="content-page">
      <p className="eyebrow">{page.sourcePath}</p>
      <MDXProvider
        components={{
          WorkflowExample,
          a: (props) => <MdxLink {...props} page={page} />,
        }}
      >
        <Page />
      </MDXProvider>
    </article>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">moyarich/actions</p>
          <h1>Reusable GitHub Actions</h1>
          <p>
            Documentation and real, copyable caller workflows for every
            supported reusable workflow.
          </p>
        </div>
        <a href="https://github.com/moyarich/actions">GitHub repository</a>
      </header>

      <div className="playground-layout">
        <aside className="sidebar" aria-label="Documentation navigation">
          {CONTENT_SECTIONS.map((section) => (
            <section key={section.id} className="sidebar-section">
              <h2>{section.label}</h2>
              <p>{section.description}</p>
              <nav>
                {section.pages.map((page) => (
                  <Link key={page.route} to={page.route}>
                    {page.title}
                  </Link>
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
