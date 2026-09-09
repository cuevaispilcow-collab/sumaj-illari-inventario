// Definición de qué secciones puede ver/usar cada rol, combinado con
// la ubicación de la cuenta (ver utils/constants.js → SECCIONES_POR_UBICACION).
// "gerente" ve todo, en cualquier ubicación — administra las 2 empresas.

import { SECCIONES_POR_UBICACION } from "./utils/constants.js";

export const SECCIONES_POR_ROL = {
  gerente: ["dashboard", "productos", "ventas", "demanda", "analisis", "margenes", "movimientos", "transferencias", "compras", "produccion", "auditoria", "nuevo"],
  vendedora: ["productos", "ventas", "movimientos", "transferencias", "nuevo"],
};

export function puedeVer(rol, seccion, ubicacion) {
  const permitidasPorRol = SECCIONES_POR_ROL[rol] || [];
  if (!permitidasPorRol.includes(seccion)) return false;
  if (rol === "gerente") return true; // la gerente no se restringe por ubicación
  const permitidasPorUbicacion = SECCIONES_POR_UBICACION[ubicacion];
  if (permitidasPorUbicacion == null) return true; // null = sin restricción extra
  return permitidasPorUbicacion.includes(seccion);
}

// Vista de inicio según el rol al entrar a la app.
export function vistaInicial(rol) {
  return rol === "gerente" ? "dashboard" : "ventas";
}

