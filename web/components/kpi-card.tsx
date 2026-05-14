export function KpiCard({
  label,
  value,
  hint,
  hintColor = "ash",
}: {
  label: string;
  value: string;
  hint?: string;
  hintColor?: "ash" | "positive" | "negative";
}) {
  const hintColors: Record<typeof hintColor, string> = {
    ash: "#78716c",
    positive: "#1d9e75",
    negative: "#dc2626",
  };

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 10,
        boxShadow: "rgba(0,0,0,0.05) 0px 4px 16px 0px",
        padding: 18,
      }}
    >
      <div style={{ fontSize: 11, color: "#78716c", marginBottom: 8 }}>
        {label}
      </div>
      <div
        className="tnum"
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.4px",
          color: "#0c0a09",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: hintColors[hintColor],
            marginTop: 6,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
