export const TIPOS = ["Materia prima", "En proceso", "Terminado", "Reventa"];
export const TIPO_COLORS = { "Materia prima": "#a8a29e", "En proceso": "#d97706", "Terminado": "#ea580c", "Reventa": "#78716c" };

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
