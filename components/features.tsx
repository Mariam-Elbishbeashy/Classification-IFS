"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Heart, Brain, Sparkles, Shield, Users, TrendingUp } from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "Inner Character Discovery",
    description: "Identify and understand your unique inner parts through engaging questions and AI-powered analysis",
    color: "from-primary to-secondary",
    image: "/brain-psychology-character-discovery-illustration.jpg",
  },
  {
    icon: Heart,
    title: "Emotional Healing",
    description: "Experience personalized healing journeys guided by compassionate AI that adapts to your needs",
    color: "from-secondary to-accent",
    image: "/heart-emotional-healing-compassion-illustration.jpg",
  },
  {
    icon: Sparkles,
    title: "3D Avatar Interactions",
    description: "Engage with your inner characters as beautiful 3D avatars that reflect your emotional state",
    color: "from-accent to-primary",
    image: "/3d-avatar-character-interaction-illustration.jpg",
  },
  {
    icon: Users,
    title: "IFS Therapy Based",
    description: "Built on proven Internal Family Systems therapy principles for authentic self-awareness",
    color: "from-primary to-accent",
    image: "/therapy-family-systems-connection-illustration.jpg",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Monitor your emotional growth with detailed insights and celebrate your healing milestones",
    color: "from-secondary to-primary",
    image: "/progress-growth-tracking-chart-illustration.jpg",
  },
  {
    icon: Shield,
    title: "Safe & Private",
    description: "Your journey is protected with end-to-end encryption and complete data privacy",
    color: "from-accent to-secondary",
    image: "/security-privacy-shield-protection-illustration.jpg",
  },
]

export function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { amount: 0.2 })

  return (
    <section id="features" ref={ref} className="py-20 sm:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-balance">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Transform Your
            </span>
            <br />
            <span className="text-foreground">Inner World</span>
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Powerful features designed to guide you through a meaningful journey of self-discovery and emotional healing
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.03, y: -8 }}
              className="group relative"
            >
              <div className="relative h-full bg-card border border-border rounded-3xl overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                {/* Gradient Background on Hover */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                />

                {/* Image Section */}
                <div className="relative h-48 bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center overflow-hidden">
                  <img
                    src={feature.image || "/placeholder.svg"}
                    alt={feature.title}
                    className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
                  />
                  <div
                    className={`absolute inset-0 bg-gradient-to-t ${feature.color} opacity-20 group-hover:opacity-30 transition-opacity`}
                  />
                </div>

                {/* Content Section */}
                <div className="relative z-10 p-6 sm:p-8">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold mb-3 text-card-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
