import type { ComponentType } from "react";

type ContentPageModule = {
  default: ComponentType;
  meta?: {
    title?: string;
    description?: string;
  };
};

export type ContentPage = {
  route: string;
  sourcePath: string;
  title: string;
  description?: string;
  Component: ComponentType;
};

type ContentSection = {
  id: "docs" | "examples";
  label: string;
  description: string;
  pages: ContentPage[];
};

function humanize(value: string) {
  return value
    .replace(/^\d+-/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createPages(
  modules: Record<string, ContentPageModule>,
): ContentPage[] {
  return Object.entries(modules)
    .map(([path, pageModule]) => {
      const sourcePath = path.replace("../../../", "");
      const route = `/${sourcePath.replace(/\/(?:page\.mdx|README\.md)$/, "").replace(/\.md$/, "")}`;
      const routeSegments = route.split("/").filter(Boolean);

      return {
        route,
        sourcePath,
        title:
          pageModule.meta?.title ??
          humanize(routeSegments.at(-1) ?? "Overview"),
        description: pageModule.meta?.description,
        Component: pageModule.default,
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));
}

const docsModules = import.meta.glob(["../../../docs/**/page.mdx", "../../../docs/**/*.md"], {
  eager: true,
}) as Record<string, ContentPageModule>;

const exampleModules = import.meta.glob(["../../../examples/**/page.mdx", "../../../examples/**/*.md"], {
  eager: true,
}) as Record<string, ContentPageModule>;

export const CONTENT_SECTIONS: ContentSection[] = [
  {
    id: "docs",
    label: "Docs",
    description: "Authoritative documentation for the workspace-tools package.",
    pages: createPages(docsModules).filter((page, _, pages) => !page.sourcePath.endsWith("README.md") || !pages.some((candidate) => candidate.route === page.route && candidate.sourcePath.endsWith("page.mdx"))),
  },
  {
    id: "examples",
    label: "CLI examples",
    description: "Copyable command examples loaded directly from examples.",
    pages: createPages(exampleModules).filter((page, _, pages) => !page.sourcePath.endsWith("README.md") || !pages.some((candidate) => candidate.route === page.route && candidate.sourcePath.endsWith("page.mdx"))),
  },
];
