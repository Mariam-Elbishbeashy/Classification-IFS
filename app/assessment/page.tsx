"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Assessment } from "@/components/assessment"
import { Loader2 } from "lucide-react"

export default function AssessmentPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = () => {
      // Check for token in localStorage
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem("token")
        if (!token) {
          router.push("/login")
        } else {
          setIsAuthenticated(true)
          setLoading(false)
        }
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <Assessment />
}