import { Suspense } from "react"
import { LampLogin } from "@/components/lamp-login"

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <p className="mt-4 text-white/50">Loading secure sign-in…</p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LampLogin />
    </Suspense>
  )
}
