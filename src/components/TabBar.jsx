import { useEffect, useRef } from "react";

/**
 * Accessible tab bar (WAI-ARIA tabs pattern): arrow keys / Home / End move
 * between tabs; the panel is rendered by the caller with `panelProps(id)`.
 */
export function TabBar({ tabs, active, onSelect, label, idPrefix }) {
  const refs = useRef({});

  useEffect(() => {
    refs.current[active]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  const onKeyDown = (event, index) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div className="page-tabs no-print" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => {
            refs.current[tab.id] = el;
          }}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={active === tab.id ? 0 : -1}
          className="tab"
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab__count tabular">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
