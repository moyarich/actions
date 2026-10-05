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
      const route = `/${sourcePath.replace(/\/page\.mdx$/, "")}`;
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

const docsModules = import.meta.glob("../../../docs/**/page.mdx", {
  eager: true,
}) as Record<string, ContentPageModule>;

const exampleModules = import.meta.glob("../../../examples/**/page.mdx", {
  eager: true,
}) as Record<string, ContentPageModule>;

export const CONTENT_SECTIONS: ContentSection[] = [
  { id: "docs", label: "Docs", pages: createPages(docsModules) },
  { id: "examples", label: "Examples", pages: createPages(exampleModules) },
];
