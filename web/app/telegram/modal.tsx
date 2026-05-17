"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12,10,9,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 8,
          padding: 20,
          maxWidth,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-0.005em",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              color: "#78716c",
              cursor: "pointer",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 500,
        color: "#0c0a09",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "7px 10px",
        fontSize: 13,
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        ...(props.style ?? {}),
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "7px 10px",
        fontSize: 13,
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        background: "white",
        ...(props.style ?? {}),
      }}
    />
  );
}

export function Btn({
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: "white",
      border: "1px solid #e5e7eb",
      color: "#0c0a09",
    },
    primary: {
      background: "#3ba6f1",
      border: "1px solid #3ba6f1",
      color: "white",
    },
    danger: {
      background: "white",
      border: "1px solid #dc2626",
      color: "#dc2626",
    },
    ghost: {
      background: "rgba(120,114,109,0.08)",
      border: "1px solid #e5e7eb",
      color: "#0c0a09",
    },
  };
  return (
    <button
      {...props}
      style={{
        padding: "6px 14px",
        fontSize: 12,
        borderRadius: 4,
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        ...styles[variant],
        ...(props.style ?? {}),
      }}
    />
  );
}

export function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div
      style={{
        marginTop: 10,
        padding: "8px 10px",
        background: "rgba(220,38,38,0.08)",
        color: "#dc2626",
        fontSize: 12,
        borderRadius: 4,
        border: "1px solid rgba(220,38,38,0.2)",
      }}
    >
      {msg}
    </div>
  );
}
