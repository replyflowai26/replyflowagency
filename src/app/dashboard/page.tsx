import { redirect } from "next/navigation"
import { signOut } from "./actions"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data) {
    redirect("/login")
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050609] px-6 text-white">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-sm tracking-widest text-cyan-300">REPLYFLOW AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Workspace access verified.
        </h1>
        <p className="mt-3 text-white/50">
          Your authenticated dashboard foundation is ready.
        </p>
        <form action={signOut} className="mt-8">
          <button
            type="submit"
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-cyan-100"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  )
}
