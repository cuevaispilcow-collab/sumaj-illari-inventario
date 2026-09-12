import React, { useState } from "react";
import {
  Package, Search, CheckCircle2, XCircle, Edit3, Trash2,
} from "lucide-react";
import { TIPOS } from "../utils/constants.js";
import { formatSoles } from "../utils/format.js";
import EmptyState from "../components/EmptyState.jsx";

import { registrarAuditoria } from "../firestoreSync.js";

export default function Productos({ productos, variantes, modelos, onSaveModelos, inventarios, onSaveInventarios, movimientos, ventas, onSave, showToast, setView, rol, ubicacion, esConsolidado, nombreVista, nombre: nombreUsuario }) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editingRotId, setEditingRotId] = useState(null);
  const [editRotValue, setEditRotValue] = useState("");
  const [editandoProducto, setEditandoProducto] = useState(null); // producto completo en edición (modal)

  const filtrados = productos.filter((p) => {
    const matchesQ =
      q.trim() === "" ||
      p.producto.toLowerCase().includes(q.toLowerCase()) ||
      p.codigo.toLowerCase().includes(q.toLowerCase()) ||
      p.categoria.toLowerCase().includes(q.toLowerCase()) ||
      (p.descripcion || "").toLowerCase().includes(q.toLowerCase());
    const matchesTipo = tipo === "todos" || p.tipo === tipo;
    return matchesQ && matchesTipo;
  });

  function startEdit(p) {
    setEditingId(p.id);
    setEditValue(p.stockMinimo != null ? String(p.stockMinimo) : "");
  }

  // El stock mínimo y el umbral de rotación son propios de CADA
  // ubicación (lo que es "poco stock" en Tienda X no es lo mismo que en
  // la planta), así que se guardan en el inventario de esta ubicación.
  function guardarEnInventario(p, cambios) {
    const clave = `${p.id}__${ubicacion}`;
    const existente = (inventarios || []).find((i) => i.id === clave);
    const base = existente || {
      id: clave, varianteId: p.id, ubicacion,
      stock: p.stock || 0, stockMinimo: p.stockMinimo ?? null,
      fechaIncorporacion: p.fechaIncorporacion || null,
    };
    const actualizado = { ...base, ...cambios };
    const nuevos = existente
      ? (inventarios || []).map((i) => (i.id === clave ? actualizado : i))
      : [...(inventarios || []), actualizado];
    return onSaveInventarios(nuevos);
  }

  async function saveEdit(p) {
    const val = editValue.trim() === "" ? null : Number(editValue);
    if (editValue.trim() !== "" && (isNaN(val) || val < 0)) {
      showToast("error", "El stock mínimo debe ser un número válido, 0 o mayor.");
      return;
    }
    await guardarEnInventario(p, { stockMinimo: val });
    setEditingId(null);
    showToast("success", "Stock mínimo actualizado.");
  }

  // El umbral de "rotación lenta" (a partir de cuántos días avisar) lo
  // define cada gerente por producto — no es un número que la app deba
  // adivinar, porque una tela y una prenda de temporada pueden rotar a
  // ritmos muy distintos.
  function startEditRot(p) {
    setEditingRotId(p.id);
    setEditRotValue(p.diasRotacionAlerta != null ? String(p.diasRotacionAlerta) : "");
  }

  async function saveEditRot(p) {
    const val = editRotValue.trim() === "" ? null : Number(editRotValue);
    if (editRotValue.trim() !== "" && (isNaN(val) || val <= 0)) {
      showToast("error", "El umbral de rotación debe ser un número mayor a cero.");
      return;
    }
    await guardarEnInventario(p, { diasRotacionAlerta: val });
    setEditingRotId(null);
    showToast("success", "Umbral de rotación actualizado.");
  }

  function statusOf(p) {
    if (p.stockMinimo == null) return "sin_definir";
    return p.stock <= p.stockMinimo ? "bajo" : "ok";
  }

  // Cuántos días lleva el producto en el catálogo desde que se incorporó.
  // Productos creados antes de esta función no tienen el dato — se muestra
  // "—" en vez de inventar una fecha.
  function diasEnInventario(p) {
    if (!p.fechaIncorporacion) return null;
    const dias = Math.floor((new Date() - new Date(p.fechaIncorporacion + "T00:00:00")) / 86400000);
    return dias >= 0 ? dias : null;
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
          placeholder="Buscar por nombre, código, categoría o descripción"
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
              <th className="text-right px-4 py-2 font-medium text-stone-600">Días en inventario</th>
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
                    ) : esConsolidado ? (
                      <span className="text-stone-600">
                        {p.stockMinimo != null ? p.stockMinimo : <span className="text-stone-300">sin definir</span>}
                      </span>
                    ) : (
                      <button onClick={() => startEdit(p)} className="text-stone-600 hover:text-red-600 inline-flex items-center gap-1">
                        {p.stockMinimo != null ? p.stockMinimo : <span className="text-stone-300">sin definir</span>}
                        <Edit3 size={11} className="opacity-50" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {(() => {
                      const dias = diasEnInventario(p);
                      const umbral = p.diasRotacionAlerta;
                      const lenta = dias != null && umbral != null && dias > umbral && p.stock > 0;
                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={lenta ? "text-amber-600 font-semibold" : "text-stone-600"} title={lenta ? `Lleva más de ${umbral} días en inventario` : undefined}>
                            {dias == null ? <span className="text-stone-300">—</span> : dias}
                          </span>
                          {rol === "gerente" && esConsolidado && (
                            <span className="text-[10px] text-stone-400">
                              alerta: {umbral != null ? `${umbral}d` : "sin definir"}
                            </span>
                          )}
                          {rol === "gerente" && !esConsolidado && (
                            editingRotId === p.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus type="number" min="1" value={editRotValue}
                                  onChange={(e) => setEditRotValue(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveEditRot(p)}
                                  placeholder="días"
                                  className="w-14 px-1 py-0.5 rounded border border-red-400 text-xs text-stone-800 bg-white text-right focus:outline-none"
                                />
                                <button onClick={() => saveEditRot(p)} className="text-red-600 hover:text-red-800">
                                  <CheckCircle2 size={13} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => startEditRot(p)} className="text-[10px] text-stone-400 hover:text-red-600 inline-flex items-center gap-0.5">
                                alerta: {umbral != null ? `${umbral}d` : "sin definir"}
                                <Edit3 size={9} className="opacity-60" />
                              </button>
                            )
                          )}
                        </div>
                      );
                    })()}
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
          variantes={variantes}
          modelos={modelos}
          onSaveModelos={onSaveModelos}
          movimientos={movimientos}
          ventas={ventas}
          onSave={onSave}
          showToast={showToast}
          onClose={() => setEditandoProducto(null)}
          nombreUsuario={nombreUsuario}
          rol={rol}
          inventarios={inventarios}
          onSaveInventarios={onSaveInventarios}
          ubicacion={ubicacion}
          esConsolidado={esConsolidado}
          nombreVista={nombreVista}
        />
      )}
    </div>
  );
}


function EditarProductoModal({ producto, productos, variantes, modelos, onSaveModelos, inventarios, onSaveInventarios, ubicacion, esConsolidado, nombreVista, movimientos, ventas, onSave, showToast, onClose, nombreUsuario, rol }) {
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

  // Si hay otras tallas con este mismo código, el código no se puede
  // renombrar desde aquí (afectaría a las tallas hermanas). Para
  // renombrarlo, hazlo cuando sea la única talla de ese modelo.
  const tallasHermanas = variantes.filter((v) => v.codigo === producto.codigo && v.id !== producto.id);
  const puedeEditarCodigo = tallasHermanas.length === 0;

  async function handleEliminar() {
    // Al eliminar, también se quita de cualquier Ficha técnica que lo usara
    // como insumo (si no, quedaría una referencia rota "producto eliminado").
    const nuevasVariantes = variantes
      .filter((p) => p.id !== producto.id)
      .map((p) => (p.receta ? { ...p, receta: p.receta.filter((r) => r.materiaPrimaId !== producto.id) } : p));
    try {
      setGuardando(true);
      await onSave(nuevasVariantes, movimientos, ventas);
      showToast("success", `Producto "${producto.producto}" eliminado.`);
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombreUsuario || "?", rol, accion: "PRODUCTO_ELIMINADO", ubicacion,
        detalle: `Eliminó ${producto.producto}${producto.talla !== "Única" ? " - " + producto.talla : ""}`,
      }).catch(() => {});
      onClose();
    } catch (err) {
      setError("No se pudo eliminar: " + (err && err.message ? err.message : String(err)));
      setGuardando(false);
    }
  }

  async function handleGuardar() {
    if (esConsolidado) {
      setError("Estás en modo consolidado — elige una sede específica arriba para poder guardar cambios de stock.");
      return;
    }
    if (!codigo.trim() || !categoria.trim() || !nombre.trim()) {
      setError("Código, categoría y nombre son obligatorios.");
      return;
    }
    const nuevoId = `${codigo.trim()}-${talla.trim() || "Única"}`;
    const chocaConOtro = variantes.some((p) => p.id !== producto.id && p.id === nuevoId);
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

    // Campos de Modelo (compartidos por TODAS las tallas de este código):
    // se actualiza el modelo una sola vez, y automáticamente aplica a
    // todas sus tallas — así nunca quedan desincronizadas entre sí.
    // Si este producto se creó ANTES de separar Modelo y Talla, puede que
    // todavía no tenga un modelo propio — en ese caso se crea recién aquí,
    // en vez de perder silenciosamente los cambios de nombre/categoría.
    const modeloActualizado = { codigo: codigo.trim(), categoria: categoria.trim(), producto: nombre.trim(), descripcion: descripcion.trim(), unidad, tipo };
    const existeModelo = modelos.some((m) => m.codigo === producto.codigo);
    const nuevosModelos = existeModelo
      ? modelos.map((m) => (m.codigo === producto.codigo ? modeloActualizado : m))
      : [...modelos, modeloActualizado];

    // Campos propios de esta talla únicamente (identidad, no stock).
    const original = variantes.find((v) => v.id === producto.id);
    const varianteActualizada = {
      ...original,
      id: nuevoId, codigo: codigo.trim(), talla: talla.trim() || "Única",
    };
    let nuevasVariantes = variantes.map((p) => (p.id === producto.id ? varianteActualizada : p));

    // El stock y stock mínimo son de ESTA ubicación → van al inventario.
    const claveVieja = `${producto.id}__${ubicacion}`;
    const claveNueva = `${nuevoId}__${ubicacion}`;
    const invExistente = (inventarios || []).find((i) => i.id === claveVieja);
    // Nota: si este producto ya tenía un costo registrado (en "costos"),
    // renombrar su código/talla acá NO renombra ese registro — se ve
    // "sin costo" hasta la próxima compra o transferencia. No es un
    // problema de seguridad, solo un dato que se recalcula solo; renombrar
    // el código de un producto es poco frecuente, así que se deja así por
    // ahora en vez de complicar este cambio.
    const invBase = invExistente || {
      id: claveVieja, varianteId: producto.id, ubicacion,
      stock: producto.stock || 0, stockMinimo: producto.stockMinimo ?? null,
      fechaIncorporacion: producto.fechaIncorporacion || null,
    };
    const invActualizado = { ...invBase, id: claveNueva, varianteId: nuevoId, stock: st, stockMinimo: sm };
    const nuevosInventarios = invExistente
      ? (inventarios || []).map((i) => (i.id === claveVieja ? invActualizado : i))
      : [...(inventarios || []), invActualizado];

    // Si cambió el ID (código o talla), mantenemos el historial enlazado
    // actualizando las referencias en movimientos, ventas Y en las Fichas
    // técnicas de otros productos que lo usen como insumo.
    let nuevosMovimientos = movimientos;
    let nuevasVentas = ventas;
    if (nuevoId !== producto.id) {
      nuevosMovimientos = movimientos.map((m) =>
        m.productoId === producto.id
          ? { ...m, productoId: nuevoId, productoNombre: `${nombre.trim()}${varianteActualizada.talla !== "Única" ? " - " + varianteActualizada.talla : ""}` }
          : m
      );
      nuevasVariantes = nuevasVariantes.map((p) =>
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
      await onSaveModelos(nuevosModelos);
      await onSaveInventarios(nuevosInventarios);
      await onSave(nuevasVariantes, nuevosMovimientos, nuevasVentas);
      showToast("success", `Producto "${nombre.trim()}" actualizado.`);
      const camposCambiados = [];
      if (categoria.trim() !== producto.categoria) camposCambiados.push("categoría");
      if (nombre.trim() !== producto.producto) camposCambiados.push("nombre");
      if (tipo !== producto.tipo) camposCambiados.push("tipo");
      if (unidad !== producto.unidad) camposCambiados.push("unidad");
      if (st !== producto.stock) camposCambiados.push("stock");
      if (String(sm) !== String(producto.stockMinimo)) camposCambiados.push("stock mínimo");
      registrarAuditoria({
        fecha: new Date().toISOString(), usuario: nombreUsuario || "?", rol, accion: "PRODUCTO_EDITADO", ubicacion,
        detalle: `Editó ${nombre.trim()}${camposCambiados.length > 0 ? " (" + camposCambiados.join(", ") + ")" : ""}`,
      }).catch(() => {});
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
          {!puedeEditarCodigo && (
            <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
              Nombre, categoría, tipo, descripción y unidad se aplican a las {tallasHermanas.length + 1} tallas de este modelo (código {producto.codigo}), no solo a esta.
            </p>
          )}
          {esConsolidado && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Estás viendo {nombreVista} — el stock y stock mínimo son por sede, así que no se pueden guardar desde acá. Elige una sede específica arriba para editarlos. Sí podés seguir eliminando el producto del catálogo.
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de inventario</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)}
                  className={`py-2 rounded text-sm font-medium border transition ${tipo === t ? "" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}
                  style={tipo === t ? { backgroundColor: "var(--marca-600)", borderColor: "var(--marca-600)", color: "var(--marca-texto)" } : undefined}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Código <span className="text-red-600">*</span></label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={!puedeEditarCodigo}
                title={!puedeEditarCodigo ? "Hay otras tallas con este código — no se puede renombrar desde aquí." : undefined}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-stone-100 disabled:text-stone-500" />
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
              <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} disabled={esConsolidado}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-stone-100 disabled:text-stone-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Stock mínimo (opcional)</label>
            <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} disabled={esConsolidado}
              placeholder="Dejar vacío si aún no se define"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-stone-100 disabled:text-stone-500" />
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
                <button onClick={handleEliminar} disabled={guardando} className="flex-1 py-1.5 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60 peligro">
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
          <button onClick={handleGuardar} disabled={guardando || esConsolidado}
            className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

