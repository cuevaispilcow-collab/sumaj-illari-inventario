export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}


export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}


export function formatSoles(n) {
  const num = Number(n) || 0;
  return "S/ " + num.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


export function formatFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1]} ${y}`;
}

