import React, { useState } from "react";
import {
  XCircle, PackagePlus,
} from "lucide-react";
import { TIPOS } from "../utils/constants.js";

export default function NuevoProducto({ productos, movimientos, onSave, showToast, setView }) {
  const [tipo, setTipo] = useState("Materia prima");
  const [codigo, setCodigo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [producto, setProducto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [talla, setTalla] = useState("Única");
  const [unidad, setUnidad] = useState("unidades");
  const [stockInicial, setStockInicial] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [error, setError] = useState("");
  const [camposFaltantes, setCamposFaltantes] = useState([]);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (enviando) return;

    const faltantes = [];
    if (!codigo.trim()) faltantes.push("codigo");
    if (!categoria.trim()) faltantes.push("categoria");
    if (!producto.trim()) faltantes.push("producto");
    if (faltantes.length > 0) {
      const msg = "Falta completar: " + faltantes.map((f) => ({ codigo: "Código", categoria: "Categoría", producto: "Nombre del producto" }[f])).join(", ") + ".";
      setCamposFaltantes(faltantes);
      setError(msg);
      return;
    }
    setCamposFaltantes([]);

    const id = `${codigo.trim()}-${talla.trim() || "Única"}`;
    if (productos.some((p) => p.id === id)) {
      const msg = `Ya existe un producto con código "${codigo.trim()}" y talla/variante "${talla.trim() || "Única"}". Cambia el código o la talla.`;
      setError(msg);
      return;
    }
    const si = stockInicial.trim() === "" ? 0 : Number(stockInicial);
    if (isNaN(si) || si < 0) {
      return setError("El stock inicial debe ser un número válido, 0 o mayor.");
    }
    const sm = stockMinimo.trim() === "" ? null : Number(stockMinimo);
    if (stockMinimo.trim() !== "" && (isNaN(sm) || sm < 0)) {
      return setError("El stock mínimo debe ser un número válido.");
    }

    const nuevo = {
      id, codigo: codigo.trim(), categoria: categoria.trim(), producto: producto.trim(),
      descripcion: descripcion.trim(), talla: talla.trim() || "Única", unidad,
      stock: si, stockMinimo: sm, tipo,
    };
    try {
      setEnviando(true);
      await onSave([...productos, nuevo], movimientos);
      showToast("success", `Producto "${producto}" agregado a ${tipo}.`);
      setCodigo(""); setCategoria(""); setProducto(""); setDescripcion("");
      setTalla("Única"); setStockInicial(""); setStockMinimo(""); setError("");
      setView("productos");
    } catch (err) {
      const msg = "No se pudo guardar el producto: " + (err && err.message ? err.message : String(err));
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de inventario</label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((t) => (
              <button type="button" key={t} onClick={() => setTipo(t)}
                style={tipo === t ? { backgroundColor: "#EE0000", borderColor: "#EE0000", color: "#ffffff" } : undefined}
                className={`py-2 rounded text-sm font-medium border transition ${
                  tipo === t ? "" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Código <span className="text-red-600">*</span></label>
            <input value={codigo} onChange={(e) => { setCodigo(e.target.value); if (camposFaltantes.includes("codigo")) setCamposFaltantes(camposFaltantes.filter((f) => f !== "codigo")); }} placeholder="Ej: MP001"
              className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 ${camposFaltantes.includes("codigo") ? "border-red-600" : "border-stone-300"}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Categoría <span className="text-red-600">*</span></label>
            <input value={categoria} onChange={(e) => { setCategoria(e.target.value); if (camposFaltantes.includes("categoria")) setCamposFaltantes(camposFaltantes.filter((f) => f !== "categoria")); }} placeholder="Ej: Telas"
              className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 ${camposFaltantes.includes("categoria") ? "border-red-600" : "border-stone-300"}`} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Nombre del producto <span className="text-red-600">*</span></label>
          <input value={producto} onChange={(e) => { setProducto(e.target.value); if (camposFaltantes.includes("producto")) setCamposFaltantes(camposFaltantes.filter((f) => f !== "producto")); }} placeholder="Ej: Tela drill naranja"
            className={`w-full px-3 py-2 rounded-lg border text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500 ${camposFaltantes.includes("producto") ? "border-red-600" : "border-stone-300"}`} />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Descripción (opcional)</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Color, modelo, detalle"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Talla/variante</label>
            <input value={talla} onChange={(e) => setTalla(e.target.value)} placeholder="Única"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Unidad</label>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="unidades">unidades</option>
              <option value="metros">metros</option>
              <option value="kg">kg</option>
              <option value="rollos">rollos</option>
              <option value="pares">pares</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Stock inicial</label>
            <input type="number" min="0" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Stock mínimo (opcional)</label>
          <input type="number" min="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} placeholder="Dejar vacío si aún no se define"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>

        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <XCircle size={14} /> {error}
          </p>
        )}

        <button type="button" onClick={handleSubmit} disabled={enviando} className="w-full py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition flex items-center justify-center gap-2">
          <PackagePlus size={16} /> {enviando ? "Agregando..." : "Agregar producto"}
        </button>
      </form>
    </div>
  );
}

