"use client"

import type { Variants } from "motion/react"

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const cardViewport = { once: true, amount: 0.18 } as const

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
}

export const fadeUpLarge: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

export const fadeFromLeft: Variants = {
  hidden: { opacity: 0, x: -14 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.55, ease: EASE } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
}

const instantize = (v: Variants): Variants => {
  const visible = v.visible
  if (!visible || typeof visible === "function") return { ...v }
  return { ...v, visible: { ...visible, transition: { duration: 0, delay: 0 } } }
}

export const fadeUpInstant = instantize(fadeUp)
export const fadeUpLargeInstant = instantize(fadeUpLarge)
export const fadeFromLeftInstant = instantize(fadeFromLeft)
export const scaleInInstant = instantize(scaleIn)

export const staggerContainerInstant: Variants = {
  hidden: {},
  visible: { transition: { duration: 0 } },
}