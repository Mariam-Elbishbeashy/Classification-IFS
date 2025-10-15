"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { UserPlus, Sparkles, MessageCircle, TrendingUp } from "lucide-react"

const steps = [
  {
    icon: UserPlus,
    title: "Create Your Profile",
    description: "Answer thoughtful questions that help us understand your emotional landscape and inner world",
    number: "01",
  },
  {
    icon: Sparkles,
    title: "Meet Your Characters",
    description: "Discover your inner characters as 3D avatars, each representing different aspects of your psyche",
    number: "02",
  },
  {
    icon: MessageCircle,
    title: "Begin Conversations",
    description: "Engage in meaningful dialogues with your inner parts, guided by compassionate AI support",
    number: "03",
  },
  {
    icon: TrendingUp,
    title: "Track Your Growth",
    description: "Monitor your healing journey with insights, progress updates, and personalized recommendations",
    number: "04",
  },
]

export function HowItWorks() {
  const ref = useRef(null)
  const isInView = useInView(ref, { amount: 0.4 })

  return (
    <section id="how-it-works" ref={ref} className="py-20 sm:py-32 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-balance">
            <span className="text-foreground">Your Journey</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              In Four Steps
            </span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            A simple, guided process to help you connect with your inner self and begin your healing journey
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              className="relative mb-12 last:mb-0"
            >
              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute left-1/2 top-24 w-0.5 h-24 bg-gradient-to-b from-primary/50 to-transparent -translate-x-1/2" />
              )}

              <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
                {/* Number and Icon */}
                <div className="flex-shrink-0 relative">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <step.icon className="w-10 h-10 sm:w-12 sm:h-12 text-white relative z-10" />
                  </motion.div>
                  <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{step.number}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center lg:text-left">
                  <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">{step.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">{step.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
