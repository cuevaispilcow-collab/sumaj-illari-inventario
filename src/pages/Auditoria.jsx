import React, { useState, useMemo } from "react";
import { ClipboardList, User, Calendar } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";

const ETIQUETAS_ACCION = {
  VENTA: { label: "Venta", color: "bg-teal-100 text-teal-700" },
  COMPRA: { label: "Compra", color: "bg-blue-100 text-blue-700" },
  MOVIMIENTO: { label: "Movimiento", color: "bg-stone-100 text-stone-600" },
  PRODUCCION: { label: "Producción", color: "bg-amber-100 text-amber-700" },
  PRODUCTO_CREADO: { label: "Producto creado", color: "bg-teal-100 text-teal-700" },
  PRODUCTO_EDITADO: { label: "Producto editado", color: "bg-amber-100 text-amber-700" },
  PRODUCTO_ELIMINADO: { label: "Producto eliminado", color: "bg-red-100 text-red-700" },
  RECETA: { label: "Ficha técnica", color: "bg-purple-100 text-purple-700" },
  PEDIDO_TOMADO: { label: "Pedido tomado", color: "bg-blue-100 text-blue-700" },
  PEDIDO_ETAPA: { label: "Etapa de pedido", color: "bg-stone-100 text-stone-600" },
  PEDIDO_COMPLETADO: { label: "Pedido completado", color: "bg-teal-100 text-teal-700" },
};

function formatFechaHora(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function Auditoria({ auditoria }) {
  const [filtroUsuario, setFiltroUsuario] = useState("todos");

  const usuarios = useMemo(() => {
    const set = new Set((auditoria || []).map((a) => a.usuario));
    return Array.from(set);
  }, [auditoria]);

  const registros = useMemo(() => {
    const lista = (auditoria || []).filter((a) => filtroUsuario === "todos" || a.usuario === filtroUsuario);
    return [...lista].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [auditoria, filtroUsuario]);

  if (auditoria === null) {
    return <p className="text-sm text-stone-400 py-6 text-center">Cargando auditoría...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Registro de actividad</h2>
        {usuarios.length > 1 && (
          <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="todos">Todos</option>
            {usuarios.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        )}
      </div>

      {registros.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Todavía no hay actividad registrada" body="Cada venta, compra, producción, pedido o cambio de producto va a aparecer aquí, con quién lo hizo y cuándo." />
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm divide-y divide-stone-100">
          {registros.map((r) => {
            const etiqueta = ETIQUETAS_ACCION[r.accion] || { label: r.accion, color: "bg-stone-100 text-stone-600" };
            return (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${etiqueta.color}`}>
                  {etiqueta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-800">{r.detalle}</p>
                  <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1"><User size={11} /> {r.usuario}</span>
                    <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatFechaHora(r.fecha)}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
