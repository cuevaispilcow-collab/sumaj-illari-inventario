import React, { useState } from "react";
import {
  Search, Edit3,
} from "lucide-react";

export default function SelectorProducto({ productos, value, onChange, placeholder = "Busca por nombre, código, categoría o descripción..." }) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const seleccionado = productos.find((p) => p.id === value);

  const filtrados = query.trim() === ""
    ? productos
    : productos.filter((p) => {
        const t = query.toLowerCase();
        return (
          p.producto.toLowerCase().includes(t) ||
          p.codigo.toLowerCase().includes(t) ||
          p.categoria.toLowerCase().includes(t) ||
          p.talla.toLowerCase().includes(t) ||
          (p.descripcion || "").toLowerCase().includes(t)
        );
      });

  function elegir(p) {
    onChange(p.id);
    setQuery("");
    setAbierto(false);
  }

  return (
    <div className="relative">
      {seleccionado && !abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white text-left"
        >
          <span className="truncate">
            <span className="text-stone-400 font-mono text-xs mr-1.5">{seleccionado.codigo}</span>
            {seleccionado.producto}{seleccionado.talla !== "Única" ? ` - ${seleccionado.talla}` : ""}
            <span className="text-stone-400"> · stock: {seleccionado.stock}</span>
          </span>
          <Edit3 size={13} className="text-stone-400 shrink-0 ml-2" />
        </button>
      ) : (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            autoFocus={abierto}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setAbierto(true)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white rounded-lg border border-stone-200 shadow-lg">
            {filtrados.length === 0 && (
              <p className="px-3 py-3 text-sm text-stone-400">No se encontraron productos.</p>
            )}
            {filtrados.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => elegir(p)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 border-b border-stone-50 last:border-0 ${
                  p.id === value ? "bg-red-50" : ""
                }`}
              >
                <span className="text-stone-400 font-mono text-xs mr-1.5">{p.codigo}</span>
                <span className="text-stone-800">{p.producto}{p.talla !== "Única" ? ` - ${p.talla}` : ""}</span>
                <span className="text-stone-400"> · {p.categoria} · stock: {p.stock}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

