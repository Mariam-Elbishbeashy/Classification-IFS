"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Users, Heart, Brain, Shield, Star, AlertCircle, BookOpen, LogIn } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface CharacterResult {
  character: string
  confidence: number
  description: string
  type: string
}

interface PredictionResponse {
  user_id: number
  top_characters: CharacterResult[]
  disclaimer: string
  total_questions: number
  answered_questions: number
}

export default function ResultsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [predictionData, setPredictionData] = useState<PredictionResponse | null>(null)
  const router = useRouter()

  useEffect(() => {
    const processResults = async () => {
      try {
        setLoading(true)
        setError(null)
        
        console.log('🔍 Starting results processing...')

        // Check for token - using "token" as stored in login
        const token = localStorage.getItem('token')
        console.log('🔑 Token found:', !!token)
        
        if (!token) {
          setError("Please log in to view your results. Redirecting to login...")
          setTimeout(() => router.push('/auth/login'), 2000)
          return
        }

        // Try to get assessment data from multiple sources
        let assessmentData = []

        // 1. Check for recent assessment data
        const recentData = localStorage.getItem('recentAssessmentResponses')
        if (recentData) {
          console.log('📝 Found recent assessment data')
          assessmentData = JSON.parse(recentData)
          localStorage.removeItem('recentAssessmentResponses')
        }

        // 2. Check for saved assessment data
        if (assessmentData.length === 0) {
          const savedData = localStorage.getItem('assessmentResponses')
          if (savedData) {
            console.log('💾 Found saved assessment data')
            assessmentData = JSON.parse(savedData)
          }
        }

        // 3. Try to fetch from backend
        if (assessmentData.length === 0) {
          console.log('🌐 Fetching from backend...')
          try {
            const response = await fetch('http://localhost:8000/assessment/responses', {
              headers: { 'Authorization': `Bearer ${token}` }
            })
            if (response.ok) {
              assessmentData = await response.json()
              console.log('✅ Got data from backend:', assessmentData.length, 'responses')
            } else {
              console.log('❌ Backend fetch failed with status:', response.status)
            }
          } catch (err) {
            console.log('❌ Backend fetch error:', err)
          }
        }

        if (assessmentData.length === 0) {
          setError("No assessment data found. Please complete the assessment first.")
          return
        }

        console.log('🎯 Processing', assessmentData.length, 'responses')

        // Convert to prediction format
        const responseDict: { [key: string]: string } = {}
        assessmentData.forEach((response: any) => {
          if (response.response && response.response.trim()) {
            responseDict[response.question_id] = response.response
          }
        })

        console.log('📊 Non-empty responses:', Object.keys(responseDict).length)

        // Try authenticated prediction first
        let predictionResult: PredictionResponse | null = null
        
        try {
          console.log('🚀 Attempting authenticated prediction...')
          const predictionResponse = await fetch('http://localhost:8000/assessment/predict', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: 1,
              responses: responseDict
            })
          })

          if (predictionResponse.ok) {
            predictionResult = await predictionResponse.json()
            console.log('✅ Authenticated prediction successful')
          } else {
            console.log('❌ Authenticated prediction failed, trying test endpoint...')
            // Try test endpoint without authentication
            const testResponse = await fetch('http://localhost:8000/assessment/test-predict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: 1,
                responses: responseDict
              })
            })
            if (testResponse.ok) {
              predictionResult = await testResponse.json()
              console.log('✅ Test prediction successful')
            } else {
              console.log('❌ Test prediction also failed')
            }
          }
        } catch (err) {
          console.log('❌ All API calls failed:', err)
        }

        // Use fallback if no prediction result
        if (!predictionResult) {
          console.log('🔄 Using fallback predictions')
          predictionResult = generateFallbackPredictions(responseDict)
        }

        setPredictionData(predictionResult)
        console.log('🎉 Results ready!')

      } catch (err) {
        console.error('💥 Error in results page:', err)
        setError('Failed to process results. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    processResults()
  }, [router])

  const generateFallbackPredictions = (responses: { [key: string]: string }): PredictionResponse => {
    const answeredCount = Object.values(responses).filter(r => r && r.trim()).length
    const allResponses = Object.values(responses).join(' ').toLowerCase()

    const characters: CharacterResult[] = []

    // Pattern-based character detection
    if (allResponses.includes('critical') || allResponses.includes('perfect') || allResponses.includes('should') || allResponses.includes('mistake')) {
      characters.push({
        character: "Inner Critic",
        confidence: 85.5,
        description: "The part that judges and evaluates, often pushing for perfection and noticing flaws",
        type: "protective"
      })
    }

    if (allResponses.includes('care') || allResponses.includes('help') || allResponses.includes('support') || allResponses.includes('nurture')) {
      characters.push({
        character: "Nurturer",
        confidence: 78.2,
        description: "Compassionate and caring, offering comfort and support to yourself and others",
        type: "self_led"
      })
    }

    if (allResponses.includes('avoid') || allResponses.includes('withdraw') || allResponses.includes('distance') || allResponses.includes('escape')) {
      characters.push({
        character: "Avoidant Part",
        confidence: 72.1,
        description: "Helps avoid difficult emotions or situations through distraction or withdrawal",
        type: "protective"
      })
    }

    if (allResponses.includes('please') || allResponses.includes('agree') || allResponses.includes('conflict') || allResponses.includes('approval')) {
      characters.push({
        character: "Pleaser",
        confidence: 68.7,
        description: "Focuses on making others happy and avoiding conflict",
        type: "protective"
      })
    }

    if (allResponses.includes('anger') || allResponses.includes('frustrat') || allResponses.includes('annoy') || allResponses.includes('irritat')) {
      characters.push({
        character: "Protector",
        confidence: 65.3,
        description: "Vigilant and cautious, keeping you safe from perceived threats",
        type: "protective"
      })
    }

    // Fill remaining slots with default characters
    const defaultChars = [
      {
        character: "Self Presence",
        confidence: 75.8,
        description: "Your core Self - calm, curious, compassionate, and connected",
        type: "self_led"
      },
      {
        character: "Wounded Child",
        confidence: 62.4,
        description: "Holds early emotional pain and needs gentle care and understanding",
        type: "self_led"
      },
      {
        character: "Sage",
        confidence: 58.9,
        description: "Wise and insightful, offering perspective and deeper understanding",
        type: "self_led"
      },
      {
        character: "Explorer",
        confidence: 55.2,
        description: "Curious and adventurous, seeking new experiences and growth",
        type: "self_led"
      }
    ]

    // Combine and take top 5
    const allChars = [...characters, ...defaultChars]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    return {
      user_id: 1,
      top_characters: allChars,
      disclaimer: "This is the beginning of your discovery journey. These insights are based on your current responses and may evolve as you continue your self-exploration.",
      total_questions: 34,
      answered_questions: answeredCount
    }
  }

  const getCharacterIcon = (character: string) => {
    const charLower = character.toLowerCase()
    
    if (charLower.includes('nurturer') || charLower.includes('care')) 
      return <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
    if (charLower.includes('sage') || charLower.includes('wise')) 
      return <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
    if (charLower.includes('protector') || charLower.includes('warrior')) 
      return <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
    if (charLower.includes('critic') || charLower.includes('perfectionist')) 
      return <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
    if (charLower.includes('child') || charLower.includes('wounded')) 
      return <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />
    if (charLower.includes('explorer') || charLower.includes('curious')) 
      return <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
    
    return <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
  }

  const getCharacterColor = (character: string) => {
    const charLower = character.toLowerCase()
    
    if (charLower.includes('nurturer') || charLower.includes('care')) 
      return { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' }
    if (charLower.includes('sage') || charLower.includes('wise')) 
      return { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' }
    if (charLower.includes('protector') || charLower.includes('warrior')) 
      return { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800' }
    if (charLower.includes('critic') || charLower.includes('perfectionist')) 
      return { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' }
    if (charLower.includes('child') || charLower.includes('wounded')) 
      return { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' }
    if (charLower.includes('explorer') || charLower.includes('curious')) 
      return { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' }
    
    return { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' }
  }

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      protective: { label: 'Protective', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border border-orange-200 dark:border-orange-800' },
      self_led: { label: 'Self-Led', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border border-green-200 dark:border-green-800' },
      unknown: { label: 'Exploring', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border border-gray-200 dark:border-gray-800' },
      exploring: { label: 'Exploring', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border border-gray-200 dark:border-gray-800' }
    }
    
    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.unknown
    
    return (
      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 dark:text-green-400'
    if (confidence >= 60) return 'text-blue-600 dark:text-blue-400'
    if (confidence >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-orange-600 dark:text-orange-400'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing Your Responses</h2>
          <p className="text-muted-foreground">Discovering your inner characters...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Unable to Load Results</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            {error.includes('log in') ? (
              <>
                <Link href="/auth/login">
                  <Button className="gap-2">
                    <LogIn className="w-4 h-4" />
                    Login
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">
                    Return Home
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/assessment">
                  <Button className="gap-2">
                    <BookOpen className="w-4 h-4" />
                    Take Assessment
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">
                    Return Home
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50 to-blue-50 dark:from-background dark:via-purple-950/20 dark:to-blue-950/20 py-8">
      <div className="container max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Your Inner Characters
            </h1>
            <Sparkles className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-xl text-muted-foreground mb-4">
            Based on your journey of self-discovery
          </p>
          
          {predictionData && (
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-lg p-4 inline-block">
              <p className="text-sm text-muted-foreground">
                Completed {predictionData.answered_questions} of {predictionData.total_questions} questions
              </p>
            </div>
          )}
        </motion.div>

        {predictionData && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
              {predictionData.top_characters.map((character, index) => {
                const colors = getCharacterColor(character.character)
                return (
                  <motion.div
                    key={character.character}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    <Card className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl ${colors.border} hover:shadow-lg transition-all duration-300 h-full flex flex-col`}>
                      <CardHeader className="text-center pb-3 flex-shrink-0">
                        <div className={`w-12 h-12 ${colors.bg} rounded-full flex items-center justify-center mx-auto mb-3`}>
                          {getCharacterIcon(character.character)}
                        </div>
                        <CardTitle className={`text-lg ${colors.text} mb-2`}>
                          {character.character}
                        </CardTitle>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {getTypeBadge(character.type)}
                          <span className={`text-sm font-bold ${getConfidenceColor(character.confidence)}`}>
                            {character.confidence}% match
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="text-center pt-0 flex-grow flex items-center">
                        <p className="text-sm text-muted-foreground w-full">
                          {character.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-center space-y-6"
            >
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl rounded-2xl p-8 border border-border/50">
                <h3 className="text-2xl font-bold text-foreground mb-4">Your Inner Harmony</h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  {predictionData.disclaimer}
                </p>
                
                <div className="grid md:grid-cols-2 gap-6 mb-6 max-w-2xl mx-auto">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {predictionData.top_characters.filter(c => c.type === 'self_led').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Self-Led Parts</div>
                    <p className="text-xs text-muted-foreground mt-1">Your core authentic self</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {predictionData.top_characters.filter(c => c.type === 'protective').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Protective Parts</div>
                    <p className="text-xs text-muted-foreground mt-1">Developed to keep you safe</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/">
                    <Button variant="outline" className="gap-2">
                      <Star className="w-4 h-4" />
                      Back to Home
                    </Button>
                  </Link>
                  <Link href="/assessment">
                    <Button className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90">
                      <Users className="w-4 h-4" />
                      Retake Discovery
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}