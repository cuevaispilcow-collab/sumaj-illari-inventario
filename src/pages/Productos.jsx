import React, { useState } from "react";
import {
  Package, Search, CheckCircle2, XCircle, Edit3, Trash2,
} from "lucide-react";
import { TIPOS } from "../utils/constants.js";
import { formatSoles } from "../utils/format.js";
import EmptyState from "../components/EmptyState.jsx";

export default function Productos({ productos, movimientos, ventas, onSave, showToast, setView, rol }) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editandoProducto, setEditandoProducto] = useState(null); // producto completo en edición (modal)

  const filtrados = productos.filter((p) => {
    const matchesQ =
      q.trim() === "" ||
      p.producto.toLowerCase().includes(q.toLowerCase()) ||
      p.codigo.toLowerCase().includes(q.toLowerCase()) ||
      p.categoria.toLowerCase().includes(q.toLowerCase());
    const matchesTipo = tipo === "todos" || p.tipo === tipo;
    return matchesQ && matchesTipo;
  });

  function startEdit(p) {
    setEditingId(p.id);
    setEditValue(p.stockMinimo != null ? String(p.stockMinimo) : "");
  }

  async function saveEdit(p) {
    const val = editValue.trim() === "" ? null : Number(editValue);
    if (editValue.trim() !== "" && (isNaN(val) || val < 0)) {
      showToast("error", "El stock mínimo debe ser un número válido, 0 o mayor.");
      return;
    }
    const newProductos = productos.map((x) => (x.id === p.id ? { ...x, stockMinimo: val } : x));
    await onSave(newProductos, movimientos);
    setEditingId(null);
    showToast("success", "Stock mínimo actualizado.");
  }

  function statusOf(p) {
    if (p.stockMinimo == null) return "sin_definir";
    return p.stock <= p.stockMinimo ? "bajo" : "ok";
  }

  if (productos.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="El catálogo está vacío"
        body="Agrega productos con su nombre y tipo (materia prima, en proceso, terminado o reventa). No se inventa nada aquí."
        actionLabel="Registrar producto"
        onAction={() => setView("nuevo")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {["todos", ...TIPOS].map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              tipo === t ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
            }`}
          >
            {t === "todos" ? "Todos" : t}
            <span className="ml-1 opacity-60">({t === "todos" ? productos.length : productos.filter((p) => p.tipo === t).length})</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, código o categoría"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Código</th>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Tipo</th>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Producto</th>
              <th className="text-left px-4 py-2 font-medium text-stone-600">Talla</th>
              <th className="text-right px-4 py-2 font-medium text-stone-600">Stock</th>
              <th className="text-right px-4 py-2 font-medium text-stone-600">Stock mínimo</th>
              {rol === "gerente" && <th className="text-right px-4 py-2 font-medium text-stone-600">Costo unit.</th>}
              <th className="text-center px-4 py-2 font-medium text-stone-600">Estado</th>
              <th className="text-center px-4 py-2 font-medium text-stone-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const status = statusOf(p);
              return (
                <tr key={p.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2 text-stone-500 font-mono text-xs whitespace-nowrap">{p.id}</td>
                  <td className="px-4 py-2 text-stone-600 whitespace-nowrap">{p.tipo}</td>
                  <td className="px-4 py-2 text-stone-800">{p.producto}</td>
                  <td className="px-4 py-2 text-stone-500">{p.talla}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${p.stock === 0 ? "text-red-600" : "text-stone-800"}`}>
                    {p.stock} <span className="text-xs font-normal text-stone-400">{p.unidad}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(p)}
                          className="w-16 px-1.5 py-1 rounded border border-red-400 text-sm text-stone-800 bg-white text-right focus:outline-none"
                        />
                        <button onClick={() => saveEdit(p)} className="text-red-600 hover:text-red-800">
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-stone-600 hover:text-red-600 inline-flex items-center gap-1">
                        {p.stockMinimo != null ? p.stockMinimo : <span className="text-stone-300">sin definir</span>}
                        <Edit3 size={11} className="opacity-50" />
                      </button>
                    )}
                  </td>
                  {rol === "gerente" && (
                    <td className="px-4 py-2 text-right text-stone-600">
                      {p.costoUnitario != null ? formatSoles(p.costoUnitario) : <span className="text-stone-300">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        status === "bajo" ? "bg-red-500" : status === "ok" ? "bg-green-500" : "bg-stone-200"
                      }`}
                      title={status === "bajo" ? "Bajo el mínimo" : status === "ok" ? "Por encima del mínimo" : "Sin mínimo definido"}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => setEditandoProducto(p)}
                      title="Editar producto"
                      className="p-1.5 rounded text-stone-500 hover:text-red-600 hover:bg-red-50 transition"
                    >
                      <Edit3 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={rol === "gerente" ? 9 : 8} className="px-4 py-8 text-center text-stone-400">
                  No se encontraron productos con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editandoProducto && (
        <EditarProductoModal
          producto={editandoProducto}
          productos={productos}
          movimientos={movimientos}
          ventas={ventas}
          onSave={onSave}
          showToast={showToast}
          onClose={() => setEditandoProducto(null)}
        />
      )}
    </div>
  );
}


function EditarProductoModal({ producto, productos, movimientos, ventas, onSave, showToast, onClose }) {
  const [codigo, setCodigo] = useState(producto.codigo);
  const [categoria, setCategoria] = useState(producto.categoria);
  const [nombre, setNombre] = useState(producto.producto);
  const [descripcion, setDescripcion] = useState(producto.descripcion || "");
  const [talla, setTalla] = useState(producto.talla);
  const [unidad, setUnidad] = useState(producto.unidad);
  const [stock, setStock] = useState(String(producto.stock));
  const [stockMinimo, setStockMinimo] = useState(producto.stockMinimo != null ? String(producto.stockMinimo) : "");
  const [tipo, setTipo] = useState(producto.tipo);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  async function handleEliminar() {
    // Al eliminar, también se quita de cualquier Ficha técnica que lo usara
    // como insumo (si no, quedaría una referencia rota "producto eliminado").
    const nuevosProductos = productos
      .filter((p) => p.id !== producto.id)
      .map((p) => (p.receta ? { ...p, receta: p.receta.filter((r) => r.materiaPrimaId !== producto.id) } : p));
    try {
      setGuardando(true);
      await onSave(nuevosProductos, movimientos, ventas);
      showToast("success", `Producto "${producto.producto}" eliminado.`);
      onClose();
    } catch (err) {
      setError("No se pudo eliminar: " + (err && err.message ? err.message : String(err)));
      setGuardando(false);
    }
  }

  async function handleGuardar() {
    if (!codigo.trim() || !categoria.trim() || !nombre.trim()) {
      setError("Código, categoría y nombre son obligatorios.");
      return;
    }
    const nuevoId = `${codigo.trim()}-${talla.trim() || "Única"}`;
    const chocaConOtro = productos.some((p) => p.id !== producto.id && p.id === nuevoId);
    if (chocaConOtro) {
      setError(`Ya existe otro producto con código "${codigo.trim()}" y talla "${talla.trim() || "Única"}".`);
      return;
    }
    const st = Number(stock);
    if (isNaN(st) || st < 0) {
      setError("El stock debe ser un número válido, 0 o mayor.");
      return;
    }
    const sm = stockMinimo.trim() === "" ? null : Number(stockMinimo);
    if (stockMinimo.trim() !== "" && (isNaN(sm) || sm < 0)) {
      setError("El stock mínimo debe ser un número válido.");
      return;
    }

    const actualizado = {
      ...producto,
      id: nuevoId, codigo: codigo.trim(), categoria: categoria.trim(), producto: nombre.trim(),
      descripcion: descripcion.trim(), talla: talla.trim() || "Única", unidad,
      stock: st, stockMinimo: sm, tipo,
    };
    let nuevosProductos = productos.map((p) => (p.id === producto.id ? actualizado : p));

    // Si cambió el ID (código o talla), mantenemos el historial enlazado
    // actualizando las referencias en movimientos, ventas Y en las Fichas
    // técnicas de otros productos que lo usen como insumo.
    let nuevosMovimientos = movimientos;
    let nuevasVentas = ventas;
    if (nuevoId !== producto.id) {
      nuevosMovimientos = movimientos.map((m) =>
        m.productoId === producto.id
          ? { ...m, productoId: nuevoId, productoNombre: `${actualizado.producto}${actualizado.talla !== "Única" ? " - " + actualizado.talla : ""}` }
          : m
      );
      nuevosProductos = nuevosProductos.map((p) =>
        p.receta
          ? { ...p, receta: p.receta.map((r) => (r.materiaPrimaId === producto.id ? { ...r, materiaPrimaId: nuevoId } : r)) }
          : p
      );
    }
    if (codigo.trim() !== producto.codigo) {
      nuevasVentas = ventas.map((v) => (v.idProducto === producto.codigo ? { ...v, idProducto: codigo.trim() } : v));
    }

    try {
      setGuardando(true);
      await onSave(nuevosProductos, nuevosMovimientos, nuevasVentas);
      showToast("success", `Producto "${nombre.trim()}" actualizado.`);
      onClose();
    } catch (err) {
      setError("No se pudo guardar el cambio: " + (err && err.message ? err.message : String(err)));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800">Editar producto</h3>
          <button onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de inventario</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`py-2 rounded text-sm font-medium border transition ${tipo === t ? "" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}
                  style={tipo === t ? { backgroundColor: "#EE0000", borderColor: "#EE0000", color: "#ffffff" } : undefined}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Código <span className="text-red-600">*</span></label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Categoría <span className="text-red-600">*</span></label>
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nombre del producto <span className="text-red-600">*</span></label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Descripción (opcional)</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Talla/variante</label>
              <input value={talla} onChange={(e) => setTalla(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Unidad</label>
              <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="unidades">unidades</option>
                <option value="metros">metros</option>
                <option value="conos">conos</option>
                <option value="kg">kg</option>
                <option value="pares">pares</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Stock</label>
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Stock mínimo (opcional)</label>
            <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)}
              placeholder="Dejar vacío si aún no se define"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {confirmarBorrar && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-red-700 font-medium">
                ¿Seguro que quieres eliminar "{producto.producto}" ({producto.talla})? Esto no borra sus ventas o movimientos pasados, solo el producto del catálogo.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmarBorrar(false)} className="flex-1 py-1.5 rounded border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-white">
                  No, cancelar
                </button>
                <button onClick={handleEliminar} disabled={guardando} className="flex-1 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60">
                  {guardando ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-stone-200">
          {!confirmarBorrar && (
            <button onClick={() => setConfirmarBorrar(true)} title="Eliminar este producto"
              className="p-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 size={17} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

