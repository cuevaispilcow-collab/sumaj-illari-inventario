import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Shield, HardHat } from "lucide-react";
import { auth, db } from "./firebase.js";

// Pantalla de login + control de quién está autenticado y qué rol tiene.
// El rol de cada persona se guarda en Firestore, colección "USUARIOS",
// documento = su UID, campo "rol" = "gerente" o "vendedora".
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [rol, setRol] = useState(null);
  const [nombre, setNombre] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [error, setError] = useState("");
  const [cargandoLogin, setCargandoLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chainState, setChainState] = useState("idle"); // idle | success | error
  const [transicionando, setTransicionando] = useState(false);
  // Puramente visual — no toca cómo se valida la contraseña, solo si se
  // ve el texto o los puntos.
  const [mostrarPassword, setMostrarPassword] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "USUARIOS", u.uid));
          const crudo = snap.exists() ? snap.data().rol : "vendedora";
          const normalizado = typeof crudo === "string" ? crudo.trim().toLowerCase() : "vendedora";
          setRol(normalizado);
          const nombreGuardado = snap.exists() ? snap.data().nombre : null;
          setNombre(nombreGuardado && nombreGuardado.trim() ? nombreGuardado.trim() : u.email);
          // La ubicación dice en qué empresa/local trabaja esta cuenta
          // (sumaj_illari, jl_planta, tienda_x). La gerente no depende de
          // esto (ve todo), pero cada cuenta operativa sí necesita saberlo
          // para trabajar sobre el inventario correcto.
          const ubicacionGuardada = snap.exists() ? snap.data().ubicacion : null;
          setUbicacion(ubicacionGuardada || "sumaj_illari");
        } catch (e) {
          setRol("vendedora");
          setNombre(u.email);
          setUbicacion("sumaj_illari");
        }
      } else {
        setRol(null);
        setNombre(null);
        setUbicacion(null);
      }
    });
    return () => unsub();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setChainState("idle");
    setCargandoLogin(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setChainState("success");
      setTransicionando(true);
      setTimeout(() => setTransicionando(false), 650);
    } catch (err) {
      setChainState("error");
      setError("Correo o contraseña incorrectos.");
      setTimeout(() => setChainState("idle"), 500);
    } finally {
      setCargandoLogin(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Cargando...</p>
      </div>
    );
  }

  if (!user || transicionando) {
    return (
      <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
        {/* Formas geométricas diagonales suaves de fondo — decorativas,
            detrás de todo (z-0), para que nunca tapen el formulario. */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-[#12294d]/[0.04] rotate-12 rounded-[3rem] pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-24 left-10 w-96 h-96 bg-amber-400/[0.07] rotate-12 rounded-[3rem] pointer-events-none" aria-hidden="true" />

        {/* Columna del formulario. El "temblor" que antes tenía el
            candado/cadena ahora se aplica acá directo cuando el correo o
            la contraseña están mal — mismo comportamiento, sin la
            animación de cadena roja que ya no encaja con esta paleta. */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16 relative z-10">
          <div className="w-full max-w-sm">
            <div className="relative w-14 h-14 mb-6">
              <Shield size={56} strokeWidth={1.5} className="text-[#12294d]" />
              <HardHat size={24} className="absolute inset-0 m-auto text-amber-400" />
            </div>

            <h1 className="leading-none mb-3">
              <span className="block text-[#12294d] font-black text-4xl tracking-tight">Bienvenido</span>
              <span className="block text-[#12294d] font-medium text-2xl tracking-tight mt-1">al sistema</span>
            </h1>
            <div className="w-12 h-1 rounded-full bg-amber-400 mb-4" />
            <p className="text-slate-500 text-sm mb-8">Gestión inteligente de equipos de protección personal.</p>

            <form onSubmit={handleLogin} className={`space-y-4 ${chainState === "error" ? "chain-shake" : ""}`}>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  placeholder="Correo electrónico"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12294d] focus:border-transparent"
                />
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={mostrarPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                  placeholder="Contraseña"
                  className="w-full pl-11 pr-11 py-3.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12294d] focus:border-transparent"
                />
                <button
                  type="button" onClick={() => setMostrarPassword((v) => !v)} tabIndex={-1}
                  title={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <p className="text-sm font-medium text-red-600 text-center">{error}</p>}

              <button
                type="button" onClick={handleLogin} disabled={cargandoLogin}
                className="w-full py-3.5 rounded-xl bg-[#12294d] text-white text-sm font-semibold hover:bg-[#0c1f3c] disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {cargandoLogin ? "Ingresando..." : (<>Ingresar <ArrowRight size={18} /></>)}
              </button>
            </form>
          </div>
        </div>

        {/* Columna del personaje — SOLO en pantallas grandes. Se usa
            "hidden" (no display:none con CSS aparte) + loading="lazy"
            para que en el celular el navegador ni siquiera descargue la
            imagen (pesa 1.5 MB): las vendedoras entran desde ahí todos
            los días, muchas veces con datos móviles. */}
        <div className="hidden lg:block lg:w-[42%] relative z-10">
          <img
            src={`${import.meta.env.BASE_URL}login-personaje.png`}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover object-right"
          />
        </div>
      </div>
    );
  }

  if (rol === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Cargando tu perfil...</p>
      </div>
    );
  }

  return children({ user, rol, nombre, ubicacion, cerrarSesion: () => signOut(auth) });
}
