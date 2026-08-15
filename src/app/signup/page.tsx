"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { createClient } from "@/lib/supabase/client"
import { AuthShell } from "@/components/auth-shell"

function signupErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes("already registered") || normalized.includes("already exists") || normalized