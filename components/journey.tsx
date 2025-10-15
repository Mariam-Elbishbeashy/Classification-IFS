"use client"

import { motion, useInView, useScroll, useTransform } from "framer-motion"
import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"

function MapTerrain() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
    }
  })

  const geometry = new THREE.PlaneGeometry(8, 8, 32, 32)
  const positions = geometry.attributes.position.array as Float32Array

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    positions[i + 2] = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.8 + Math.sin(x * 1.2 + y * 1.2) * 0.3
  }

  geometry.computeVertexNormals()

  return (
    <group rotation={[-Math.PI / 3, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          color="#8b5cf6"
          wireframe
          transparent
          opacity={0.6}
          emissive="#8b5cf6"
          emissiveIntensity={0.2}
        />
      </mesh>
      {[
        [1, 1, 0.5],
        [-1.5, 0.5, 0.3],
        [0.5, -1.5, 0.4],
        [-0.8, -0.8, 0.6],
        [2, -1, 0.3],
      ].map((pos, i) => (
        <mesh key={i} position={[pos[0], pos[1], pos[2]]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? "#ec4899" : "#06b6d4"}
            emissive={i % 2 === 0 ? "#ec4899" : "#06b6d4"}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  )
}

export function Journey() {
  const ref = useRef(null)
  const isInView = useInView(ref, { amount: 0.4 })
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  })

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8])
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])

  return (
    <section id="journey" ref={containerRef} className="py-20 sm:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-background/80 z-0" />
      <div className="absolute inset-0 z-0 opacity-30">
        <Canvas camera={{ position: [0, 3, 5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <pointLight position={[-5, 3, 0]} intensity={0.5} color="#ec4899" />
          <pointLight position={[5, 3, 0]} intensity={0.5} color="#06b6d4" />
          <MapTerrain />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      </div>

      <motion.div ref={ref} style={{ scale, opacity }} className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-balance">
            <span className="text-foreground">A Journey of</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Self-Discovery & Healing
            </span>
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed text-balance"
          >
            ANA is more than an app—it's your companion in understanding the complex landscape of your inner world.
            Based on Internal Family Systems therapy, we help you recognize, understand, and harmonize the different
            parts of yourself.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mt-12"
          >
            {[
              { number: "24/7", label: "AI Support" },
              { number: "100%", label: "Private & Safe" },
              { number: "∞", label: "Growth Potential" },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6"
              >
                <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-muted-foreground font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
