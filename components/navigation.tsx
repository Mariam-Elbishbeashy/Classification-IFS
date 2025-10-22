"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Menu, X, User, LogOut } from "lucide-react"

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    // Check if user is logged in
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    window.location.href = '/'
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border/50"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="font-bold text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  ANA
                </span>
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/"
                className="text-foreground/80 hover:text-foreground transition-colors font-medium"
              >
                Home
              </Link>
              <Link
                href="/#features"
                className="text-foreground/80 hover:text-foreground transition-colors font-medium"
              >
                Features
              </Link>
              <Link
                href="/#how-it-works"
                className="text-foreground/80 hover:text-foreground transition-colors font-medium"
              >
                How It Works
              </Link>
              <Link
                href="/#journey"
                className="text-foreground/80 hover:text-foreground transition-colors font-medium"
              >
                Journey
              </Link>

              {/* Conditional Navigation based on auth */}
              {user ? (
                <div className="flex items-center space-x-4">
                  <Link href="/assessment">
                    <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/25">
                      Take Assessment
                    </Button>
                  </Link>
                  <div className="flex items-center space-x-2 text-sm text-foreground/80">
                    <User className="w-4 h-4" />
                    <span>Hi, {user.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link href="/assessment">
                    <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                      Try Assessment
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/25">
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Mobile menu */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-background border-l border-border/50 z-50 md:hidden"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/50">
                  <Link href="/" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">A</span>
                    </div>
                    <span className="font-bold text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      ANA
                    </span>
                  </Link>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Navigation links */}
                <div className="flex-1 p-6 space-y-6">
                  <Link
                    href="/"
                    className="block text-lg font-medium text-foreground/80 hover:text-foreground transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    href="/#features"
                    className="block text-lg font-medium text-foreground/80 hover:text-foreground transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Features
                  </Link>
                  <Link
                    href="/#how-it-works"
                    className="block text-lg font-medium text-foreground/80 hover:text-foreground transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    How It Works
                  </Link>
                  <Link
                    href="/#journey"
                    className="block text-lg font-medium text-foreground/80 hover:text-foreground transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Journey
                  </Link>

                  {/* Assessment link - always visible */}
                  <Link
                    href="/assessment"
                    className="block"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/25">
                      Take Assessment
                    </Button>
                  </Link>
                </div>

                {/* Auth section */}
                <div className="p-6 border-t border-border/50 space-y-4">
                  {user ? (
                    <>
                      <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                        <User className="w-5 h-5 text-foreground/80" />
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-sm text-foreground/60">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full flex items-center space-x-2"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="block" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/25">
                          Sign In
                        </Button>
                      </Link>
                      <Link href="/signup" className="block" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full">
                          Create Account
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}