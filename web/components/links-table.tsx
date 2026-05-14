"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import type { LinkAggregate } from "@/lib/types";
import { ExcludeButton } from "@/components/exclude-button";

function fmtUSD(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n >= 1000 ? 0 : 2,
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  });
}

function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}

function fmtPct(n: number | null) {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}%`;
}

// ----- Sorting -----

type SortKey =
  | "link_name"
  | "link_type"
  | "subs"
  | "paid_fans"
  | "earnings_net"
  | "clicks"
  | "earnings_gross"
  | "cvr";

type SortDir = "asc" | "desc";

function compareLinks(
  a: LinkAggregate,
  b: LinkAggregate,
  key: SortKey,
  dir: SortDir,
): number {
  const f = dir === "asc" ? 1 : -1;
  switch (key) {
    case "link_name":
      return f * a.link_name.localeCompare(b.link_name);
    case "link_type":
      return f * a.link_type.localeCompare(b.link_type);
    case "subs":
      return f * (a.subs - b.subs);
    case "paid_fans":
      return f * (a.paying_fans - b.paying_fans);
    case "earnings_net":
      return f * (a.earnings_net - b.earnings_net);
    case "clicks":
      return f * ((a.clicks ?? -1) - (b.clicks ?? -1));
    case "earnings_gross":
      return f * (a.earnings_gross - b.earnings_gross);
    case "cvr":
      return f * ((a.cvr ?? -1) - (b.cvr ?? -1));
  }
}

// ----- Grouping -----

interface Group {
  creator_id: string;
  creator_name: string;
  rows: LinkAggregate[];
  subtotal: {
    subs: number;
    paid_fans: number;
    earnings_net: number;
    earnings_gross: number;
    clicks: number;
    cvr: number | null;
  };
}

function groupByCreator(rows: LinkAggregate[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    let g = map.get(r.creator_id);
    if (!g) {
      g = {
        creator_id: r.creator_id,
        creator_name: r.creator_name,
        rows: [],
        subtotal: {
          subs: 0,
          paid_fans: 0,
          earnings_net: 0,
          earnings_gross: 0,
          clicks: 0,
          cvr: null,
        },
      };
      map.set(r.creator_id, g);
    }
    g.rows.push(r);
    g.subtotal.subs += r.subs;
    g.subtotal.paid_fans += r.paying_fans;
    g.subtotal.earnings_net += r.earnings_net;
    g.subtotal.earnings_gross += r.earnings_gross;
    g.subtotal.clicks += r.clicks ?? 0;
  }
  // Compute average CVR for each group (over links that have a CVR)
  for (const g of map.values()) {
    const cvrLinks = g.rows.filter((r) => r.cvr !== null);
    g.subtotal.cvr =
      cvrLinks.length > 0
        ? cvrLinks.reduce((acc, r) => acc + (r.cvr ?? 0), 0) / cvrLinks.length
        : null;
  }
  return Array.from(map.values());
}

// ----- Component -----

export function LinksTable({
  rows,
  groupByCreator: doGroup,
  excludedCount,
  showExcluded,
  currentParams,
}: {
  rows: LinkAggregate[];
  groupByCreator: boolean;
  excludedCount: number;
  showExcluded: boolean;
  currentParams: { range?: string; creators?: string; showExcluded?: string };
}) {
  // Local exclusion state — tracks links the user toggled in this session,
  // so we can hide/reveal them without a full page refresh.
  const [locallyExcluded, setLocallyExcluded] = useState<Set<string>>(new Set());
  const [locallyRestored, setLocallyRestored] = useState<Set<string>>(new Set());

  function handleExcludeChange(linkId: string, isExcluded: boolean) {
    setLocallyExcluded((prev) => {
      const next = new Set(prev);
      if (isExcluded) next.add(linkId);
      else next.delete(linkId);
      return next;
    });
    setLocallyRestored((prev) => {
      const next = new Set(prev);
      if (!isExcluded) next.add(linkId);
      else next.delete(linkId);
      return next;
    });
  }

  // Effective excluded state combines server data with local toggles
  function isHidden(r: LinkAggregate): boolean {
    if (showExcluded) return false; // never hide when explicitly showing all
    const effectivelyExcluded =
      (r.excluded && !locallyRestored.has(r.link_id)) ||
      locallyExcluded.has(r.link_id);
    return effectivelyExcluded;
  }

  function effectiveExcludedFlag(r: LinkAggregate): boolean {
    if (locallyRestored.has(r.link_id)) return false;
    if (locallyExcluded.has(r.link_id)) return true;
    return r.excluded;
  }

  // Accordion state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpand(creatorId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });
  }

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("earnings_net");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  function handleHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        // Default direction by column type
        key === "link_name" || key === "link_type" ? "asc" : "desc",
      );
    }
  }

  // Compute visible rows (after exclusion filter)
  const visibleRows = useMemo(
    () => rows.filter((r) => !isHidden(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, locallyExcluded, locallyRestored, showExcluded],
  );

  // Build groups or sorted flat list
  const groups = useMemo(() => {
    if (!doGroup) return null;
    const g = groupByCreator(visibleRows);
    // Sort within each group by current sort
    for (const grp of g) {
      grp.rows.sort((a, b) => compareLinks(a, b, sortKey, sortDir));
    }
    // Sort groups by their subtotal of the sortKey (when meaningful)
    g.sort((a, b) => {
      const f = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "link_name":
          return f * a.creator_name.localeCompare(b.creator_name);
        case "subs":
          return f * (a.subtotal.subs - b.subtotal.subs);
        case "earnings_net":
          return f * (a.subtotal.earnings_net - b.subtotal.earnings_net);
        case "clicks":
          return f * (a.subtotal.clicks - b.subtotal.clicks);
        case "earnings_gross":
          return f * (a.subtotal.earnings_gross - b.subtotal.earnings_gross);
        default:
          // For type/cvr — keep net as group-level order
          return b.subtotal.earnings_net - a.subtotal.earnings_net;
      }
    });
    return g;
  }, [visibleRows, doGroup, sortKey, sortDir]);

  const flatSorted = useMemo(
    () =>
      doGroup
        ? []
        : [...visibleRows].sort((a, b) => compareLinks(a, b, sortKey, sortDir)),
    [visibleRows, doGroup, sortKey, sortDir],
  );

  function expandAll() {
    if (!groups) return;
    setExpanded(new Set(groups.map((g) => g.creator_id)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }
  const allExpanded =
    groups !== null &&
    groups.length > 0 &&
    groups.every((g) => expanded.has(g.creator_id));

  // Build URL for the show-excluded toggle (server-side param)
  const toggleParams = new URLSearchParams();
  if (currentParams.range) toggleParams.set("range", currentParams.range);
  if (currentParams.creators)
    toggleParams.set("creators", currentParams.creators);
  if (!showExcluded) toggleParams.set("showExcluded", "1");
  const toggleHref = `?${toggleParams.toString()}`;

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 10,
        boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
        padding: "22px 30px 26px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 12,
        }}
      >
        <div>
          <div
            style={{ fontSize: 13, fontWeight: 500, color: "#0c0a09" }}
          >
            Link performance
          </div>
          <div style={{ fontSize: 11, color: "#78716c", marginTop: 2 }}>
            {doGroup
              ? `${groups?.length ?? 0} creator${(groups?.length ?? 0) === 1 ? "" : "s"} · click su una riga per espandere · click su una colonna per ordinare`
              : "Click su una colonna per ordinare"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {doGroup && (groups?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={allExpanded ? collapseAll : expandAll}
              style={{
                fontSize: 11,
                color: "#78716c",
                padding: "3px 10px",
                background: "transparent",
                border: "1px solid #e5e7eb",
                borderRadius: 9999,
                cursor: "pointer",
              }}
            >
              {allExpanded ? "Comprimi tutto" : "Espandi tutto"}
            </button>
          )}
          {(excludedCount > 0 || showExcluded) && (
            <Link
              href={toggleHref}
              style={{
                fontSize: 11,
                color: showExcluded ? "#3ba6f1" : "#78716c",
                textDecoration: "none",
                padding: "3px 10px",
                border: "1px solid #e5e7eb",
                borderRadius: 9999,
                background: showExcluded
                  ? "rgba(59,166,241,0.06)"
                  : "transparent",
              }}
            >
              {showExcluded
                ? "Nascondi esclusi"
                : `Mostra esclusi (${excludedCount})`}
            </Link>
          )}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            fontSize: 13,
            color: "#a8a29e",
          }}
        >
          Nessun link da mostrare.
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "32px" }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <SortableTh
                label="Creator / Link"
                sortKey="link_name"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="left"
              />
              <SortableTh
                label="Type"
                sortKey="link_type"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="left"
              />
              <SortableTh
                label="Subs"
                sortKey="subs"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <SortableTh
                label="Paid"
                sortKey="paid_fans"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <SortableTh
                label="Net"
                sortKey="earnings_net"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <SortableTh
                label="Clicks"
                sortKey="clicks"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <SortableTh
                label="Gross"
                sortKey="earnings_gross"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <SortableTh
                label="CVR"
                sortKey="cvr"
                currentKey={sortKey}
                dir={sortDir}
                onClick={handleHeaderClick}
                align="right"
              />
              <th />
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((g) => (
                  <RenderGroup
                    key={g.creator_id}
                    group={g}
                    expanded={expanded.has(g.creator_id)}
                    onToggle={() => toggleExpand(g.creator_id)}
                    onExcludeChange={handleExcludeChange}
                    isLinkExcluded={effectiveExcludedFlag}
                  />
                ))
              : flatSorted.map((r) => (
                  <RenderRow
                    key={r.link_id}
                    row={r}
                    onExcludeChange={handleExcludeChange}
                    excluded={effectiveExcludedFlag(r)}
                  />
                ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ----- Sortable header -----

function SortableTh({
  label,
  sortKey,
  currentKey,
  dir,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align: "left" | "right";
}) {
  const active = currentKey === sortKey;
  return (
    <th
      style={{
        textAlign: align,
        padding: "8px 4px",
        fontWeight: 500,
        color: active ? "#0c0a09" : "#78716c",
        fontSize: 11,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      onClick={() => onClick(sortKey)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          ...(align === "right" && { flexDirection: "row-reverse" }),
        }}
      >
        {label}
        {active &&
          (dir === "asc" ? (
            <ChevronUp size={11} color="#3ba6f1" />
          ) : (
            <ChevronDown size={11} color="#3ba6f1" />
          ))}
      </span>
    </th>
  );
}

// ----- Rows -----

function RenderGroup({
  group,
  expanded,
  onToggle,
  onExcludeChange,
  isLinkExcluded,
}: {
  group: Group;
  expanded: boolean;
  onToggle: () => void;
  onExcludeChange: (linkId: string, excluded: boolean) => void;
  isLinkExcluded: (r: LinkAggregate) => boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderBottom: "1px solid #e5e7eb",
          cursor: "pointer",
          background: expanded ? "rgba(59,166,241,0.03)" : "transparent",
          transition: "background 120ms",
        }}
      >
        <td
          style={{
            padding: "10px 4px 8px",
            color: "#0c0a09",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ChevronRight
              size={14}
              color="#78716c"
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 140ms",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {group.creator_name}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#a8a29e",
                fontWeight: 400,
              }}
            >
              · {group.rows.length} link{group.rows.length === 1 ? "" : "s"}
            </span>
          </span>
        </td>
        <td style={{ padding: "10px 4px 8px" }} />
        <Td num bold>
          {fmtInt(group.subtotal.subs)}
        </Td>
        <Td num bold>
          {fmtInt(group.subtotal.paid_fans)}
        </Td>
        <Td num bold>
          {fmtUSD(group.subtotal.earnings_net)}
        </Td>
        <Td num bold>
          {group.subtotal.clicks > 0 ? fmtInt(group.subtotal.clicks) : "—"}
        </Td>
        <Td num bold muted>
          {fmtUSD(group.subtotal.earnings_gross)}
        </Td>
        <Td num bold>
          {fmtPct(group.subtotal.cvr)}
        </Td>
        <td />
      </tr>
      {expanded &&
        group.rows.map((r) => (
          <RenderRow
            key={r.link_id}
            row={r}
            indent
            onExcludeChange={onExcludeChange}
            excluded={isLinkExcluded(r)}
          />
        ))}
    </>
  );
}

function RenderRow({
  row,
  indent,
  onExcludeChange,
  excluded,
}: {
  row: LinkAggregate;
  indent?: boolean;
  onExcludeChange: (linkId: string, excluded: boolean) => void;
  excluded: boolean;
}) {
  return (
    <tr
      data-link-id={row.link_id}
      style={{
        borderBottom: "0.5px solid #e5e7eb",
        opacity: excluded ? 0.45 : 1,
        background: indent ? "rgba(250,250,249,0.5)" : "transparent",
        transition: "background 200ms",
      }}
    >
      <td
        style={{
          padding: "8px 4px",
          paddingLeft: indent ? 30 : 4,
          color: "#0c0a09",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.link_name}
      >
        {row.link_name}
      </td>
      <td style={{ padding: "8px 4px", color: "#78716c" }}>
        {row.link_type === "TRIAL" ? "Trial" : "Tracking"}
      </td>
      <Td num>{fmtInt(row.subs)}</Td>
      <Td num>{fmtInt(row.paying_fans)}</Td>
      <Td num bold>
        {fmtUSD(row.earnings_net)}
      </Td>
      <Td num>{row.clicks !== null ? fmtInt(row.clicks) : "—"}</Td>
      <Td num muted>
        {fmtUSD(row.earnings_gross)}
      </Td>
      <Td num>{fmtPct(row.cvr)}</Td>
      <td
        style={{ padding: "8px 4px", textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <ExcludeButton
          linkId={row.link_id}
          excluded={excluded}
          onChange={(next) => onExcludeChange(row.link_id, next)}
        />
      </td>
    </tr>
  );
}

function Td({
  children,
  num,
  bold,
  muted,
}: {
  children: React.ReactNode;
  num?: boolean;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={num ? "tnum" : undefined}
      style={{
        padding: "10px 4px 8px",
        textAlign: num ? "right" : "left",
        fontWeight: bold ? 500 : 400,
        color: muted ? "#78716c" : "#0c0a09",
      }}
    >
      {children}
    </td>
  );
}
