import { useEffect, useState } from "react";

// Colores de ESTADO: fijos en las dos empresas — no cambian de
// significado según la sede que se esté viendo. Si un dato es
// "positivo / negativo / bajo atención", se pinta igual sea Sumaj
// Illari o JL. Úsalos SOLO cuando el color comunica ese significado
// (margen positivo/negativo, stock sobre/bajo el mínimo) — nunca para
// diferenciar categorías sin relación entre sí (eso es PALETA_MARCA).
export const ESTADO_COLORES = {
  success: "#059669", // verde esmeralda — positivo / ok / sobre el mínimo
  danger: "#DC2626",  // rojo — negativo / alerta / bajo el mínimo
  warning: "#D97706", // ámbar — advertencia
};

// Familia de color por EMPRESA, para todo lo que no es un estado
// (series de un gráfico, breakdown por categoría, la tarjeta "héroe" de
// una fila de métricas). Una sola familia por empresa, en variaciones
// de intensidad — nunca colores sueltos sin relación entre sí.
//
// El acento de gráficos es más profundo que el amarillo de los botones
// de JL (--marca-600 = #f5c518): ese amarillo brillante funciona para
// un botón puntual, pero pintado en área grande (barras, degradados)
// sobre fondo oscuro se vería plano y compitiendo con el fondo — misma
// familia, pero una intensidad pensada para superficies de gráfico.
const PALETA_SUMAJ = {
  acento: "#B91C1C", // rojo profundo
  serie: ["#B91C1C", "#E4634A", "#B4623D", "#8C8178"], // rojo · coral · terracota · gris cálido
};
const PALETA_JL = {
  acento: "#A16207", // ámbar profundo
  serie: ["#A16207", "#D4A94A", "#8A6D3B", "#8C8178"], // ámbar · dorado claro · ocre · gris cálido
};

// Grosor máximo de una barra (px), para que una sola categoría (ej. un
// solo producto en un ranking) no estire la barra a todo el ancho o
// alto disponible del gráfico.
export const BAR_MAX_SIZE = 36;

// Lee la familia de color de la sede ACTUAL desde el atributo data-tema
// que App.jsx pone en <html> (ver App.jsx → temaDeSesion / index.css).
// Reacciona en vivo si la gerente cambia de sede sin recargar la
// página, mismo mecanismo que ya usaba MetricCard para su acento.
export function useTemaChart() {
  const leerTema = () => (document.documentElement.getAttribute("data-tema") === "jl" ? PALETA_JL : PALETA_SUMAJ);
  const [tema, setTema] = useState(leerTema);
  useEffect(() => {
    const leer = () => setTema(leerTema());
    leer();
    const observer = new MutationObserver(leer);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => observer.disconnect();
  }, []);
  return tema;
}
