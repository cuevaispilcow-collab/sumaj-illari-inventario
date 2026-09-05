// Definición de qué secciones puede ver/usar cada rol.
// "gerente" ve todo. "vendedora" solo ve lo definido abajo.

export const SECCIONES_POR_ROL = {
  gerente: ["dashboard", "productos", "ventas", "demanda", "analisis", "margenes", "movimientos", "compras", "produccion", "nuevo"],
  vendedora: ["productos", "ventas", "movimientos", "nuevo"],
};

export function puedeVer(rol, seccion) {
  const permitidas = SECCIONES_POR_ROL[rol] || [];
  return permitidas.includes(seccion);
}

// Vista de inicio según el rol al entrar a la app.
export function vistaInicial(rol) {
  return rol === "gerente" ? "dashboard" : "ventas";
}
