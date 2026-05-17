"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/telegram", label: "Telegram" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        borderBottom: "1px solid #e5e7eb",
        background: "#fafaf9",
      }}
    >
      <div
        className="max-w-[1200px] mx-auto flex items-center justify-between"
        style={{ padding: "12px 24px" }}
      >
        <div className="flex items-center" style={{ gap: 22 }}>
          <span
            style={{
              fontWeight: 500,
              fontSize: 14,
              color: "#0c0a09",
              letterSpacing: "-0.005em",
            }}
          >
            TON-engine
          </span>
          <div className="flex" style={{ gap: 16, fontSize: 13 }}>
            {tabs.map((t) => {
              const active =
                pathname === t.href ||
                (pathname?.startsWith(t.href + "/") ?? false);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  style={{
                    color: "#0c0a09",
                    borderBottom: active
                      ? "2px solid #3ba6f1"
                      : "2px solid transparent",
                    paddingBottom: 4,
                    textDecoration: "none",
                  }}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center" style={{ gap: 10 }}>
          <form action="/auth/sign-out" method="POST">
            <button
              type="submit"
              style={{
                background: "rgba(120,114,109,0.08)",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: 11,
                color: "#0c0a09",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
