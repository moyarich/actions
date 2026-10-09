import type { ReactNode } from "react";
import "./DocsLayout.css";

type DocsLayoutProps = {
  children: ReactNode;
  toc?: ReactNode;
};

export function DocsLayout({ children, toc }: DocsLayoutProps) {
  return (
    <div className="article-layout">
      {children}
      {toc ?? null}
    </div>
  );
}
