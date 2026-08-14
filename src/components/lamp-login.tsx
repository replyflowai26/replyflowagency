"use client";

import { motion, useMotionValue } from "motion/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LampLogin() {
  const router = useRouter();
  const supabase = createClient();
  const [isOn, setIsOn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const ropeY = useMotionValue(0);

  function toggleLamp() {
    setIsOn((value) => !value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setMessage("Unable to sign in. Check your details and try again.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className={`relative min-h-screen overflow-hidden bg-[#050609] transition-colors duration-700 ${isOn ? "bg-[#111018]" : ""}`}>
      <motion.div
        animate={{ opacity: isOn ? 0.85 : 0.15, scale: isOn ? 1 : 0.85 }}
        transition={{ duration: 0.7 }}
        className="pointer-events-none absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-amber-200/20 blur-[120px]"
      />

      <div className="absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center">
        <div className="h-12 w-px bg-white/30" />
        <motion.div animate={{ rotate: isOn ? 0 : -2, y: isOn ? 0 : 4 }} className="relative">
          <div className={`h-16 w-24 rounded-b-[3rem] border border-white/20 bg-gradient-to-b from-white/90 to-white/30 shadow-2xl transition-shadow duration-700 ${isOn ? "shadow-amber-200/40" : ""}`} />
          <div className="absolute left-1/2 top-14 h-4 w-4 -translate-x-1/2 rounded-full bg-white/80" />
        </motion.div>
        <motion.button
          type="button"
          aria-label="Pull lamp rope"
          onClick={toggleLamp}
          style={{ y: ropeY }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 70 }}
          onDragEnd={() => {
            toggleLamp();
            ropeY.set(0);
          }}
          className="relative flex cursor-grab flex-col items-center active:cursor-grabbing"
        >
          <div className="h-20 w-px bg-white/35" />
          <div className="h-4 w-4 rounded-full border border-white/40 bg-white/20" />
        </motion.button>
        <p className="mt-3 text-xs tracking-widest text-white/30">PULL TO {isOn ? "TURN OFF" : "ENTER"}</p>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: isOn ? 1 : 0, y: isOn ? 0 : 30, pointerEvents: isOn ? "auto" : "none" }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex min-h-screen items-center justify-center px-6 pt-28"
      >
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
          <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Welcome back.</h1>
          <p className="mt-3 text-white/50">Enter your workspace and continue building automated systems.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="Email address"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
            />
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Password"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
            />

            {message && <p className="text-sm text-rose-300" role="alert">{message}</p>}

            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 flex justify-between text-sm text-white/50">
            <a href="/forgot-password" className="hover:text-white">Forgot password?</a>
            <a href="/signup" className="hover:text-white">Create account</a>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
