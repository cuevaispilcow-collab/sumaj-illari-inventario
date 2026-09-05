import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { ChainLock } from "./Logo.jsx";

// Pantalla de login + control de quién está autenticado y qué rol tiene.
// El rol de cada persona se guarda en Firestore, colección "USUARIOS",
// documento = su UID, campo "rol" = "gerente" o "vendedora".
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [rol, setRol] = useState(null);
  const [error, setError] = useState("");
  const [cargandoLogin, setCargandoLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chainState, setChainState] = useState("idle"); // idle | success | error
  const [transicionando, setTransicionando] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "USUARIOS", u.uid));
          const crudo = snap.exists() ? snap.data().rol : "vendedora";
          const normalizado = typeof crudo === "string" ? crudo.trim().toLowerCase() : "vendedora";
          setRol(normalizado);
        } catch (e) {
          setRol("vendedora");
        }
      } else {
        setRol(null);
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
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <p className="text-stone-500 text-sm">Cargando...</p>
      </div>
    );
  }

  if (!user || transicionando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 w-full max-w-sm space-y-5">
          <div className="flex justify-center pb-1">
            <ChainLock state={chainState} size={96} />
          </div>
          <div className="text-center -mt-1">
            <p className="leading-none">
              <span className="text-red-600 font-black tracking-tight text-4xl">SUMAJ</span>
              <span className="text-stone-900 font-black tracking-tight text-4xl"> ILLARI</span>
            </p>
            <p className="text-sm text-stone-500 mt-2">Ingresa para continuar</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">Correo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border border-stone-300 text-base text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg border border-stone-300 text-base text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          {error && <p className="text-sm font-medium text-red-600 text-center">{error}</p>}
          <button type="button" onClick={handleLogin} disabled={cargandoLogin}
            className="w-full py-3 rounded-lg bg-red-600 text-white text-base font-semibold hover:bg-red-700 disabled:opacity-60 transition">
            {cargandoLogin ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    );
  }

  if (rol === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <p className="text-stone-500 text-sm">Cargando tu perfil...</p>
      </div>
    );
  }

  return children({ user, rol, cerrarSesion: () => signOut(auth) });
}
