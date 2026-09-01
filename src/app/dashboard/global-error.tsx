"use client"

// Replaces the root layout when an uncaught error bubbles to the top of the
// dashboard. Must render its own <html>/<body> because the root layout is not
// available at this level. Production-safe: no server components or shell here.

export default function DashboardGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" style={{ background: "#05070b" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background:
            "radial-gradient(circle at 15% 5%, rgba(124,58,237,0.16), transparent 30rem), radial-gradient(circle at 90% 15%, rgba(34,211,238,0.12), transparent 28rem), #05070b",
          color: "#f5f7fb",
          fontFamily: "Arial, Helvetica, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            margin: "24px",
            padding: "40px 32px",
            textAlign: "center",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(9,12,18,0.80)",
            backdropFilter: "blur(22px)",
            boxShadow: "0 20px 70px rgba(0,0,0,0.25)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              border: "1px solid rgba(248,113,113,0.25)",
              background: "rgba(248,113,113,0.06)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "#fca5a5",
              }}
            />
          </span>
          <h1 style={{ margin: "20px 0 8px", fontSize: 20, fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.45)",
            }}
          >
            Could not load this page. Please try again. Your data remains safe.
          </p>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid rgba(103,232,249,0.25)",
                background: "rgba(103,232,249,0.08)",
                color: "#a5f3fc",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
