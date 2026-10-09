# DocOutline

Copy this entire directory into another React application. No React Router dependency is required.

```tsx
import { DocOutline } from "./components/DocOutline/DocOutline";
import { useDocOutline } from "./components/DocOutline/useDocOutline";

function Article({ children, pageKey }: { children: React.ReactNode; pageKey: string }) {
  const { articleRef, headings } = useDocOutline(pageKey, window.location.hash);
  return (
    <div>
      <article ref={articleRef}>{children}</article>
      <DocOutline headings={headings} />
    </div>
  );
}
```

`DocOutline` uses ordinary `#heading-id` links by default. For HashRouter or other routers, pass `hrefForHeading={(id) => `...`}` from the host application. The application is responsible for passing the current content key and heading fragment to `useDocOutline`.

Styles and all default design tokens are in `DocOutline.css`. Internal variables are prefixed `--_doc-outline-` and can be customized on `.doc-outline` without changing application-wide styles.

Requires React and a page that renders heading elements (`h2`, `h3`).
