import {
  Children,
  isValidElement,
  useId,
  useState,
  type ReactNode,
} from "react";
import "./CodeGroup.css";

/**
 * A syntax-highlighted code panel. Write a fenced Markdown code block inside
 * CodeTab so the MDX compiler passes it through Shiki at build time.
 */
export function CodeTab({ children }: { label: string; children: ReactNode }) {
  return <>{children}</>;
}

type TabItem = { label: string; content: ReactNode };

export function CodeGroup({ children }: { children: ReactNode }) {
  const tabs: TabItem[] = Children.toArray(children)
    .filter(isValidElement<{ label?: string; children?: ReactNode }>)
    .filter((child) => typeof child.props.label === "string")
    .map((child) => ({
      label: child.props.label!,
      content: child.props.children,
    }));
  const [selected, setSelected] = useState(0);
  const id = useId();
  if (!tabs.length) return null;

  const active = Math.min(selected, tabs.length - 1);
  return (
    <div className="code-group">
      <div
        className="code-group-tabs"
        role="tablist"
        aria-label="Code examples"
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            tabIndex={active === index ? 0 : -1}
            aria-selected={active === index}
            aria-controls={`${id}-panel-${index}`}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (active +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              setSelected(next);
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [next]?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={index}
          id={`${id}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${index}`}
          hidden={active !== index}
          className="code-group-panel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
