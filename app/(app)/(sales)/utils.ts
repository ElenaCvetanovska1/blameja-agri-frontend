export const round2 = (n: number) => Math.round(n * 100) / 100;

export const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const safeText = (v: unknown) => (typeof v === "string" ? v : "").trim();

// Discount: allow empty while typing; clamp 0..100 on blur
export const clampPercent = (raw: string) => {
  const s = raw.trim();
  if (s === "") return "";
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(100, Math.max(0, n)));
};

export const percentNum = (s: string) => {
  const n = Number.parseInt((s ?? "").trim() || "0", 10);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

// Price: allow empty, ".", "," -> ".", no letters
export const sanitizePriceInput = (raw: string) => {
  let v = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
  }
  return v;
};

export const clampPrice = (raw: string) => {
  const s = raw.trim().replace(",", ".");
  if (s === "") return "";
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return "";
  const fixed = round2(Math.max(0, n));
  return String(fixed);
};

export const priceNum = (s: string) => {
  const cleaned = (s ?? "").trim().replace(",", ".");
  const n = Number.parseFloat(cleaned || "0");
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

export const parseDigitsText = (raw: string) => {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return t;
};

export const escapeLike = (s: string) => s.replace(/[%_]/g, "\\$&");
