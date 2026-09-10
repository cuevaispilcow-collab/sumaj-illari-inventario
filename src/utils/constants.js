export const TIPOS = ["Materia prima", "En proceso", "Terminado", "Reventa"];
export const TIPO_COLORS = { "Materia prima": "#a8a29e", "En proceso": "#d97706", "Terminado": "#ea580c", "Reventa": "#78716c" };

// Las 3 ubicaciones físicas del sistema. SUMAJ ILLARI y JL son empresas
// legalmente distintas; Tienda X pertenece a JL (no es una tercera
// empresa), pero tiene su propio inventario físico.
export const UBICACIONES = [
  { id: "sumaj_illari", nombre: "Sumaj Illari", empresa: "SUMAJ ILLARI" },
  { id: "jl_planta", nombre: "JL - Planta", empresa: "JL" },
  { id: "tienda_x", nombre: "Tienda X", empresa: "JL" },
];

// Qué pestañas puede ver cada ubicación, además de lo que ya filtra el
// rol (gerente ve todo sin importar la ubicación). Tienda X es un punto
// de venta simple — no produce, no compra materia prima.
export const SECCIONES_POR_UBICACION = {
  sumaj_illari: null, // null = no restringe más allá del rol (acceso completo operativo)
  jl_planta: null,
  tienda_x: ["productos", "ventas", "movimientos", "transferencias"],
};

// Paleta de colores para gráficos, pensada para que se vea consistente
// y profesional en todo el sistema (no colores sueltos por gráfico).
export const CHART_COLORS = {
  primary: "#DC2626",  // rojo de marca — métricas principales
  danger: "#DC2626",   // alertas / bajo stock
  success: "#0D9488",  // verde azulado (teal) — positivo / ok
  info: "#2563EB",     // azul — barras informativas
  warning: "#F59E0B",  // ámbar — advertencias
  neutral: "#A8A29E",  // gris piedra — sin datos / neutral
  purple: "#7C3AED",   // morado — Yape / acento secundario
};

// Estilos compartidos para los gráficos en modo oscuro (Dashboard,
// Análisis, Demanda, Márgenes) — un solo lugar para que todos los
// gráficos se vean consistentes entre sí.
export const DARK_GRID = "#292524";
export const DARK_TICK = { fontSize: 11, fill: "#a8a29e" };
export const DARK_TOOLTIP = { fontSize: 12, borderRadius: 8, backgroundColor: "#1c1917", border: "1px solid #44403c", color: "#f5f5f4" };
export const DARK_TOOLTIP_ITEM = { color: "#f5f5f4" };
export const DARK_TOOLTIP_LABEL = { color: "#e7e5e4" };
