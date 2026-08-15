"use client"

interface BackgroundVideoProps {
  className?: string
  src?: string
}

export function BackgroundVideo({ className = "", src }: BackgroundVideoProps) {
  const videoSrc = src ?? process.env.NEXT_PUBLIC_AUTH_BACKGROUND_VIDEO_URL ?? "/visuals/replyflow-network.mp4"

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <video
        className="h-full w-full object-cover opacity-30"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/visuals/automation-network.svg"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[#05070b]/65" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(124,58,237,.18),transparent_38rem)]" />
    </div>
  )
}
