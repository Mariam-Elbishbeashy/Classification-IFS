"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Save, Sparkles, Loader2, AlertCircle, X } from "lucide-react"
import Link from "next/link"

interface Question {
  id: string
  question_id: string
  question_text: string
  question_type: string
  choices: string[] | null
  focus_area: string
  page_number: number
}

interface Responses {
  [key: string]: string
}

export function Assessment() {
  const [currentPage, setCurrentPage] = useState(1)
  const [questions, setQuestions] = useState<Question[]>([])
  const [responses, setResponses] = useState<Responses>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})

  const totalPages = 10

  useEffect(() => {
    fetchQuestions()
    fetchSavedResponses()
  }, [])

  const fetchQuestions = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/assessment/questions")
      if (response.ok) {
        const data = await response.json()
        setQuestions(data)
      }
    } catch (err) {
      console.error("Error fetching questions:", err)
      setError("Failed to load questions")
    } finally {
      setLoading(false)
    }
  }

  const fetchSavedResponses = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch("http://127.0.0.1:8000/assessment/responses", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        const responsesObj: Responses = {}
        data.forEach((item: any) => {
          responsesObj[item.question_id] = item.response
        })
        setResponses(responsesObj)
      }
    } catch (err) {
      console.error("Error fetching saved responses:", err)
    }
  }

  const getCurrentPageQuestions = () => {
    return questions.filter((q) => q.page_number === currentPage)
  }

  const handleResponseChange = (questionId: string, value: string) => {
    // If clicking the same option, unselect it
    const currentValue = responses[questionId]
    const newValue = currentValue === value ? "" : value
    
    setResponses((prev) => ({
      ...prev,
      [questionId]: newValue,
    }))
    
    // Clear validation error when user answers
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }

  const handleMultipleSelectionChange = (questionId: string, choice: string, checked: boolean) => {
    const currentValue = responses[questionId] || ""
    const currentChoices = currentValue ? currentValue.split("|") : []
    
    let newChoices: string[]
    if (checked) {
      newChoices = [...currentChoices, choice]
    } else {
      newChoices = currentChoices.filter((c) => c !== choice)
    }
    
    const newValue = newChoices.join("|")
    setResponses((prev) => ({
      ...prev,
      [questionId]: newValue,
    }))
    
    // Clear validation error when user answers
    if (validationErrors[questionId] && newValue.trim() !== "") {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }

  // Clear all selections for a question
  const clearSelection = (questionId: string, questionType: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: "",
    }))
    
    // Clear validation error
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }

  const isMultipleSelectionChecked = (questionId: string, choice: string) => {
    const currentValue = responses[questionId] || ""
    return currentValue.split("|").includes(choice)
  }

  // Validate all questions on the current page
  const validateCurrentPage = () => {
    const currentPageQuestions = getCurrentPageQuestions()
    const errors: {[key: string]: string} = {}

    currentPageQuestions.forEach(question => {
      const response = responses[question.question_id] || ""
      
      if (question.question_type === "writing" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please share your thoughts"
      }
      else if (question.question_type === "numerical" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please select a rating"
      }
      else if (question.question_type === "single_selection" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please select an option"
      }
      else if (question.question_type === "multiple_selection" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please select at least one option"
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Validate all questions in the entire assessment
  const validateAllQuestions = () => {
    const errors: {[key: string]: string} = {}

    questions.forEach(question => {
      const response = responses[question.question_id] || ""
      
      if (question.question_type === "writing" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please share your thoughts"
      }
      else if (question.question_type === "numerical" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please select a rating"
      }
      else if (question.question_type === "single_selection" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please select an option"
      }
      else if (question.question_type === "multiple_selection" && (!response || response.trim() === "")) {
        errors[question.question_id] = "Please select at least one option"
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const nextPage = () => {
    if (validateCurrentPage()) {
      if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1)
        window.scrollTo(0, 0)
      }
    } else {
      // Scroll to first error
      const firstErrorElement = document.querySelector('[data-has-error="true"]')
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      window.scrollTo(0, 0)
    }
  }

  const saveAllResponses = async () => {
    if (!validateAllQuestions()) {
      setError("Please answer all questions before submitting")
      
      // Scroll to first error
      const firstErrorElement = document.querySelector('[data-has-error="true"]')
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setError("Please log in to save your responses")
        return
      }

      // Prepare all responses from all pages
      const allResponses = questions.map((question) => ({
        question_id: question.question_id,
        response: responses[question.question_id] || "",
        page_number: question.page_number,
      }))

      const response = await fetch("http://127.0.0.1:8000/assessment/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responses: allResponses }),
      })

      if (!response.ok) {
        throw new Error("Failed to save responses")
      }

      setSuccess("🎉 All responses saved successfully! Discovering your inner characters...")
      
      // Redirect to results page after 2 seconds
      setTimeout(() => {
        window.location.href = "/results"
      }, 2000)
      
    } catch (err) {
      setError("Failed to save responses. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const getPageFocus = () => {
    const pageQuestion = questions.find((q) => q.page_number === currentPage)
    return pageQuestion?.focus_area || "Self Discovery"
  }

  // Check if all questions are answered
  const isAllQuestionsAnswered = () => {
    return questions.every(question => {
      const response = responses[question.question_id] || ""
      return response.trim() !== ""
    })
  }

  // Check if a question has a response
  const hasResponse = (questionId: string) => {
    const response = responses[questionId] || ""
    return response.trim() !== ""
  }

  // Number scale component for numerical questions
  const NumberScale = ({ questionId, value }: { questionId: string; value: string }) => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          {numbers.map((num) => (
            <button
              key={num}
              onClick={() => handleResponseChange(questionId, num.toString())}
              className={`flex flex-col items-center space-y-2 transition-all duration-200 ${
                value === num.toString() 
                  ? "scale-110 text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg
                transition-all duration-200
                ${value === num.toString()
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-background border border-border hover:bg-primary/10"
                }
              `}>
                {num}
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground px-2">
          <span>Very Low</span>
          <span>Neutral</span>
          <span>Very High</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your discovery journey...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Link href="/" className="inline-block mb-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2"
            >
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                ANA
              </h1>
            </motion.div>
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">Discover Your Inner Characters</h1>
          <p className="text-muted-foreground text-lg">
            Page {currentPage} of {totalPages} • {getPageFocus()}
          </p>
          
          {/* Completion Status */}
          {currentPage === totalPages && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4"
            >
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                isAllQuestionsAnswered() 
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" 
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
              }`}>
                {isAllQuestionsAnswered() ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    All questions answered! Ready to discover your results.
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    {questions.filter(q => !responses[q.question_id] || responses[q.question_id].trim() === "").length} questions remaining
                  </>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8"
        >
          <Progress value={(currentPage / totalPages) * 100} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground mt-2">
            <span>Beginning</span>
            <span>{Math.round((currentPage / totalPages) * 100)}% Complete</span>
            <span>Discovery</span>
          </div>
        </motion.div>

        {/* Questions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-6">
              {getCurrentPageQuestions().map((question, index) => {
                const hasError = !!validationErrors[question.question_id]
                const hasResponse = responses[question.question_id] && responses[question.question_id].trim() !== ""
                
                return (
                  <Card 
                    key={question.id} 
                    className={`bg-card/80 backdrop-blur-xl border-border/50 shadow-lg transition-all duration-200 ${
                      hasError ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20" : ""
                    }`}
                    data-has-error={hasError ? "true" : "false"}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            hasError ? "bg-red-500" : hasResponse ? "bg-green-500" : "bg-primary"
                          }`}></div>
                          {question.question_text}
                        </CardTitle>
                        
                        {/* Instruction labels */}
                        {question.question_type === "single_selection" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <span>Choose one option</span>
                          </div>
                        )}
                        
                        {question.question_type === "multiple_selection" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <span>Choose all that apply</span>
                          </div>
                        )}
                        
                        {question.question_type === "numerical" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <span>Rate from 1 to 10</span>
                          </div>
                        )}
                        
                        {question.question_type === "writing" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            <span>Share your thoughts</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Validation Error */}
                      {hasError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mt-2"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {validationErrors[question.question_id]}
                        </motion.div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      {question.question_type === "writing" && (
                        <div className="space-y-4">
                          <Input
                            id={question.question_id}
                            type="text"
                            placeholder="Share your thoughts here..."
                            value={responses[question.question_id] || ""}
                            onChange={(e) => handleResponseChange(question.question_id, e.target.value)}
                            className={`bg-background/50 border-border/50 focus:border-primary h-20 resize-none ${
                              hasError ? "border-red-300 focus:border-red-500" : ""
                            }`}
                          />
                          {/* Clear button under writing input */}
                          {hasResponse && (
                            <div className="flex justify-start">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => clearSelection(question.question_id, question.question_type)}
                                className="h-8 px-3 text-muted-foreground hover:text-foreground border border-border/50"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Clear Response
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {question.question_type === "numerical" && (
                        <div className="space-y-4">
                          <NumberScale 
                            questionId={question.question_id} 
                            value={responses[question.question_id] || ""} 
                          />
                          {/* Clear button under number scale */}
                          {hasResponse && (
                            <div className="flex justify-start">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => clearSelection(question.question_id, question.question_type)}
                                className="h-8 px-3 text-muted-foreground hover:text-foreground border border-border/50"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Clear Rating
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {question.question_type === "single_selection" && question.choices && (
                        <div className="space-y-4">
                          <RadioGroup
                            value={responses[question.question_id] || ""}
                            onValueChange={(value) => handleResponseChange(question.question_id, value)}
                            className={`
                              ${
                                question.choices.length >= 8 
                                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                                : question.choices.length > 4 
                                  ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
                                  : "space-y-3"
                              }
                            `}
                          >
                            {question.choices.map((choice, choiceIndex) => (
                              <motion.div
                                key={choiceIndex}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`
                                  flex items-center space-x-3 p-4 rounded-lg transition-all duration-200 cursor-pointer
                                  ${responses[question.question_id] === choice
                                    ? "bg-primary/10 shadow-md border border-primary/20"
                                    : `bg-background/50 hover:bg-primary/5 border ${
                                        hasError ? "border-red-300" : "border-border"
                                      }`
                                  }
                                `}
                                onClick={() => handleResponseChange(question.question_id, choice)}
                              >
                                <RadioGroupItem 
                                  value={choice} 
                                  id={`${question.question_id}-${choiceIndex}`}
                                  className="text-primary border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <Label
                                  htmlFor={`${question.question_id}-${choiceIndex}`}
                                  className="text-base font-normal cursor-pointer flex-1"
                                >
                                  {choice}
                                </Label>
                              </motion.div>
                            ))}
                          </RadioGroup>
                          {/* Clear button under single selection */}
                          {hasResponse && (
                            <div className="flex justify-start">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => clearSelection(question.question_id, question.question_type)}
                                className="h-8 px-3 text-muted-foreground hover:text-foreground border border-border/50"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Clear Selection
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {question.question_type === "multiple_selection" && question.choices && (
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-3">
                            {question.choices.map((choice, choiceIndex) => {
                              const isSelected = isMultipleSelectionChecked(question.question_id, choice);
                              return (
                                <motion.div
                                  key={choiceIndex}
                                  whileHover={{ 
                                    scale: 1.03,
                                    transition: { duration: 0.2 }
                                  }}
                                  whileTap={{ scale: 0.97 }}
                                  className="relative group cursor-pointer"
                                >
                                  <div
                                    className={`
                                      inline-flex items-center px-5 py-3 rounded-full border-2 transition-all duration-300
                                      font-medium text-sm min-w-0 max-w-xs
                                      ${isSelected
                                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                        : `border-${
                                            hasError ? "red-300" : "border"
                                          } bg-background/80 text-foreground hover:border-primary/60 hover:bg-primary/10 hover:shadow-md`
                                      }
                                    `}
                                    onClick={() => handleMultipleSelectionChange(
                                      question.question_id,
                                      choice,
                                      !isSelected
                                    )}
                                  >
                                    {/* Checkbox indicator */}
                                    <div className={`
                                      w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center transition-all duration-200
                                      ${isSelected
                                        ? "border-primary-foreground bg-primary-foreground"
                                        : `border-${
                                            hasError ? "red-300" : "muted-foreground/40"
                                          } group-hover:border-primary`
                                      }
                                    `}>
                                      {isSelected && (
                                        <motion.svg
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="w-3 h-3 text-primary"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </motion.svg>
                                      )}
                                    </div>

                                    {/* Choice text */}
                                    <span className="whitespace-nowrap truncate">
                                      {choice}
                                    </span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                          
                          {/* Selected count indicator */}
                          <div className="flex justify-between items-center text-xs text-muted-foreground mt-4">
                            <span>
                              Selected: {
                                question.choices.filter(choice => 
                                  isMultipleSelectionChecked(question.question_id, choice)
                                ).length
                              } of {question.choices.length}
                            </span>
                            <span>Click to select/deselect</span>
                          </div>

                          {/* Clear button under multiple selection */}
                          {hasResponse && (
                            <div className="flex justify-start">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => clearSelection(question.question_id, question.question_type)}
                                className="h-8 px-3 text-muted-foreground hover:text-foreground border border-border/50"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Clear All Selections
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-between items-center mt-8 pt-6 border-t border-border/50"
        >
          <Button
            variant="outline"
            onClick={prevPage}
            disabled={currentPage === 1}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-4">
            {error && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            {success && <p className="text-green-500 text-sm">{success}</p>}
            
            {/* Save All Button - Only show on last page */}
            {currentPage === totalPages && (
              <Button
                onClick={saveAllResponses}
                disabled={saving}
                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 shadow-lg shadow-green-500/25"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Discover My Inner Characters
              </Button>
            )}

            {/* Next Button - Hide on last page when Save is shown */}
            {currentPage < totalPages && (
              <Button
                onClick={nextPage}
                className="gap-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/25"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>

        {/* Completion Message for last page */}
        {currentPage === totalPages && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-center mt-8 p-6 rounded-2xl border ${
              isAllQuestionsAnswered() 
                ? "bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20" 
                : "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
            }`}
          >
            <h3 className="text-xl font-semibold text-foreground mb-2 flex items-center justify-center gap-2">
              {isAllQuestionsAnswered() ? (
                <>
                  <Sparkles className="w-5 h-5 text-primary" />
                  Journey Complete!
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  Almost There!
                </>
              )}
            </h3>
            <p className="text-muted-foreground">
              {isAllQuestionsAnswered() 
                ? "Ready to discover your inner characters? Click the button above to reveal your unique personality patterns."
                : "Please answer all questions before you can discover your inner characters."
              }
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}