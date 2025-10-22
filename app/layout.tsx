import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "ANA - Discover Your Inner Characters",
  description:
    "Embark on a transformative journey of self-discovery and emotional healing through meaningful conversations with your inner world. Based on Internal Family Systems therapy.",
  generator: "ANA Team",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}