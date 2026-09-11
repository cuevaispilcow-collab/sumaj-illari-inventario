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

// Agrupa las ubicaciones por empresa, en el mismo orden en que aparecen
// en UBICACIONES. La usan el selector de sede (para saber a qué
// empresas ofrecerles una opción "toda la empresa") y sedesDeVista()
// de abajo.
export function sedesPorEmpresa() {
  const grupos = {};
  for (const u of UBICACIONES) {
    if (!grupos[u.empresa]) grupos[u.empresa] = [];
    grupos[u.empresa].push(u);
  }
  return grupos;
}

// Una "vista de empresa" (ej. "ver JL completo, planta + tienda") se
// codifica como el texto "empresa:<NOMBRE DE LA EMPRESA>" — así se
// distingue de una sede puntual (su id tal cual) y del consolidado
// ("todas") sin necesitar una lista separada de valores válidos.
const PREFIJO_EMPRESA = "empresa:";
export function esVistaEmpresa(ubicacion) {
  return typeof ubicacion === "string" && ubicacion.startsWith(PREFIJO_EMPRESA);
}
export function empresaDeVista(ubicacion) {
  return esVistaEmpresa(ubicacion) ? ubicacion.slice(PREFIJO_EMPRESA.length) : null;
}
export function claveVistaEmpresa(empresa) {
  return `${PREFIJO_EMPRESA}${empresa}`;
}

// El corazón de todo esto: traduce CUALQUIER valor de "qué se está
// viendo" (una sede puntual, una empresa completa, o el consolidado) a
// la lista de sedes REALES que representa. Todo lo demás — filtros,
// sumas de stock, a qué sedes se le puede repartir una compra — se
// apoya en esta única función, para no repetir "cómo se arma cada
// vista" en varios lugares.
export function sedesDeVista(ubicacion) {
  if (ubicacion === "todas") return UBICACIONES.map((u) => u.id);
  const empresa = empresaDeVista(ubicacion);
  if (empresa) return UBICACIONES.filter((u) => u.empresa === empresa).map((u) => u.id);
  return [ubicacion];
}

// Nombre legible de una vista ("Sumaj Illari", "JL (todas sus sedes)",
// "todas las sedes"). Lo usan los avisos que bloquean el registro en
// modo consolidado/empresa, para no decir "todas las sedes" cuando en
// realidad se está viendo solo una empresa — un aviso impreciso genera
// desconfianza, así que vale la pena que este texto sea exacto.
export function nombreDeVista(ubicacion) {
  if (ubicacion === "todas") return "todas las sedes";
  const empresa = empresaDeVista(ubicacion);
  if (empresa) return `${empresa} (todas sus sedes)`;
  return (UBICACIONES.find((u) => u.id === ubicacion) || {}).nombre || ubicacion;
}

// Qué identidad visual (logo, nombre, colores) corresponde según la
// ubicación que se está VIENDO en este momento (para una vendedora, es
// siempre la de su cuenta; para la gerente, es la que eligió en el
// selector — sede puntual, una empresa completa, o el consolidado). En
// consolidado, o si la vista no corresponde a una sola empresa clara,
// se usa Sumaj Illari por defecto.
export function temaDeSesion(ubicacion) {
  if (ubicacion === "todas") return "sumaj";
  const empresa = esVistaEmpresa(ubicacion) ? empresaDeVista(ubicacion) : (UBICACIONES.find((u) => u.id === ubicacion) || {}).empresa;
  return empresa === "JL" ? "jl" : "sumaj";
}

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
