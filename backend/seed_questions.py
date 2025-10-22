from sqlalchemy.orm import Session
from models import Question
from database import SessionLocal
import json

def seed_questions():
    """Seed the database with all assessment questions"""
    
    QUESTIONNAIRE_STRUCTURE = {
        1: {
            "focus": "Preparation & Safety",
            "questions": {
                "q1_1": {
                    "text": "What brings you to explore your inner parts today?",
                    "type": "writing",
                    "choices": None
                },
                "q1_2": {
                    "text": "How would you rate your readiness for this exploration?",
                    "type": "numerical",
                    "choices": None
                },
                "q1_3": {
                    "text": "What is your primary intention?",
                    "type": "single_selection",
                    "choices": [
                        "To understand myself better",
                        "To heal specific patterns",
                        "To improve relationships",
                        "To find inner peace",
                        "To reduce inner conflict"
                    ]
                },
                "q1_4": {
                    "text": "What helps you feel safe enough to begin?",
                    "type": "single_selection",
                    "choices": [
                        "Reminder that all parts are welcome",
                        "Permission to go at my own pace",
                        "Assurance of confidentiality",
                        "Validation that all feelings are okay"
                    ]
                }
            }
        },
        2: {
            "focus": "Part Discovery",
            "questions": {
                "q2_1": {
                    "text": "Which part feels most present right now?",
                    "type": "single_selection",
                    "choices": [
                        "A critical/judgmental part",
                        "A fearful/anxious part",
                        "A sad/hurt part",
                        "An angry/protective part",
                        "A people-pleasing part",
                        "A numb/distant part",
                        "A perfectionistic part",
                        "An addictive/compulsive part",
                        "A playful/creative part",
                        "A wise/compassionate part"
                    ]
                },
                "q2_2": {
                    "text": "How intense is this part's presence?",
                    "type": "numerical",
                    "choices": None
                },
                "q2_3": {
                    "text": "What physical sensations accompany it?",
                    "type": "single_selection",
                    "choices": [
                        "Tightness in chest or stomach",
                        "Racing heart",
                        "Tense muscles",
                        "Heavy feeling",
                        "Numbness",
                        "Butterflies or nervous energy",
                        "Warmth or openness",
                        "Cold shivers"
                    ]
                },
                "q2_4": {
                    "text": "When did you first notice this part?",
                    "type": "single_selection",
                    "choices": [
                        "In the past few days",
                        "In the past few weeks",
                        "During a specific life event",
                        "It's been there as long as I can remember"
                    ]
                }
            }
        },
        3: {
            "focus": "Getting to Know the Part",
            "questions": {
                "q3_1": {
                    "text": "If this part had a form, what would it be?",
                    "type": "single_selection",
                    "choices": [
                        "A specific person",
                        "An animal",
                        "A mythical creature",
                        "An object or symbol",
                        "A color or energy form",
                        "A natural element"
                    ]
                },
                "q3_2": {
                    "text": "What name feels right for this part?",
                    "type": "writing",
                    "choices": None
                },
                "q3_3": {
                    "text": "How would you describe its energy?",
                    "type": "single_selection",
                    "choices": [
                        "Heavy and slow",
                        "Sharp and intense",
                        "Buzzing and anxious",
                        "Cold and distant",
                        "Warm and comforting",
                        "Strong and protective",
                        "Light and playful",
                        "Fluid and changing"
                    ]
                },
                "q3_4": {
                    "text": "What is this part's main role?",
                    "type": "single_selection",
                    "choices": [
                        "To protect me from harm",
                        "To help me fit in/be liked",
                        "To push me to achieve",
                        "To help me avoid pain",
                        "To express emotions I suppress",
                        "To maintain control",
                        "To keep me safe in relationships",
                        "To help me survive difficult situations"
                    ]
                }
            }
        },
        4: {
            "focus": "Understanding Protective Intentions",
            "questions": {
                "q4_1": {
                    "text": "What is this part trying to protect you from?",
                    "type": "single_selection",
                    "choices": [
                        "Rejection or abandonment",
                        "Failure or inadequacy",
                        "Overwhelm or loss of control",
                        "Pain or emotional hurt",
                        "Shame or judgment",
                        "Unknown dangers",
                        "Being misunderstood",
                        "Loss of love or connection"
                    ]
                },
                "q4_2": {
                    "text": "How important is this protective function?",
                    "type": "numerical",
                    "choices": None
                },
                "q4_3": {
                    "text": "What positive outcomes does it seek?",
                    "type": "multiple_selection",
                    "choices": [
                        "Safety and security",
                        "Love and connection",
                        "Success and achievement",
                        "Acceptance and belonging",
                        "Control and predictability",
                        "Peace and calm",
                        "Freedom and autonomy"
                    ]
                }
            }
        },
        5: {
            "focus": "Validation & Appreciation",
            "questions": {
                "q5_1": {
                    "text": "How has this part been helpful?",
                    "type": "single_selection",
                    "choices": [
                        "Kept me safe in difficult situations",
                        "Helped me achieve important goals",
                        "Prevented emotional pain",
                        "Helped me navigate relationships",
                        "Gave me structure and control",
                        "Helped me survive trauma",
                        "Motivated me to grow",
                        "Protected my vulnerability"
                    ]
                },
                "q5_2": {
                    "text": "What does it need you to acknowledge?",
                    "type": "multiple_selection",
                    "choices": [
                        "How hard it's worked",
                        "Its good intentions",
                        "The challenges it's faced",
                        "Its loyalty and dedication",
                        "The sacrifices it's made",
                        "Its creativity in protecting",
                        "Its endurance over time"
                    ]
                },
                "q5_3": {
                    "text": "What quality do you appreciate most?",
                    "type": "single_selection",
                    "choices": [
                        "Strength and resilience",
                        "Care and concern for your wellbeing",
                        "Alertness and awareness",
                        "Emotional expression",
                        "Boundary setting",
                        "Creativity in problem-solving",
                        "Loyalty and dedication",
                        "Courage in facing challenges"
                    ]
                },
                "q5_4": {
                    "text": "How willing are you to express gratitude?",
                    "type": "numerical",
                    "choices": None
                }
            }
        },
        6: {
            "focus": "Hearing Concerns",
            "questions": {
                "q6_1": {
                    "text": "What concerns does this part want you to understand?",
                    "type": "writing",
                    "choices": None
                },
                "q6_2": {
                    "text": "What would help it feel seen and valued?",
                    "type": "multiple_selection",
                    "choices": [
                        "Regular acknowledgment",
                        "Understanding its perspective",
                        "Including it in decisions",
                        "Respecting its concerns",
                        "Giving it voice and expression",
                        "Validating its emotions",
                        "Appreciating its efforts"
                    ]
                },
                "q6_3": {
                    "text": "How open is it to new approaches?",
                    "type": "numerical",
                    "choices": None
                }
            }
        },
        7: {
            "focus": "Exploring New Ways",
            "questions": {
                "q7_1": {
                    "text": "What support could your core Self offer?",
                    "type": "multiple_selection",
                    "choices": [
                        "More understanding and compassion",
                        "Better listening and attention",
                        "Help with difficult emotions",
                        "Shared responsibility for protection",
                        "New perspectives and choices",
                        "Comfort and reassurance",
                        "Clear communication",
                        "Respect for its wisdom"
                    ]
                },
                "q7_2": {
                    "text": "What alternative approach might work?",
                    "type": "single_selection",
                    "choices": [
                        "Gentle communication instead of criticism",
                        "Self-compassion instead of perfectionism",
                        "Healthy boundaries instead of avoidance",
                        "Direct expression instead of people-pleasing",
                        "Mindfulness instead of numbing",
                        "Vulnerability instead of protection walls",
                        "Collaboration instead of control"
                    ]
                },
                "q7_3": {
                    "text": "What responsibility could core Self take over?",
                    "type": "single_selection",
                    "choices": [
                        "Making final decisions",
                        "Handling difficult emotions",
                        "Setting healthy boundaries",
                        "Providing self-compassion",
                        "Managing relationships",
                        "Problem-solving",
                        "Self-care and nurturing",
                        "Emotional regulation"
                    ]
                }
            }
        },
        8: {
            "focus": "Integration & Healing",
            "questions": {
                "q8_1": {
                    "text": "How ready does this part feel to release burdens?",
                    "type": "numerical",
                    "choices": None
                },
                "q8_2": {
                    "text": "What healing does it most need?",
                    "type": "multiple_selection",
                    "choices": [
                        "Understanding and validation",
                        "Release of old burdens",
                        "New ways of coping",
                        "Connection with other parts",
                        "Integration with core Self",
                        "Rest and rejuvenation",
                        "Freedom to be themselves"
                    ]
                },
                "q8_3": {
                    "text": "What key insight has emerged?",
                    "type": "writing",
                    "choices": None
                }
            }
        },
        9: {
            "focus": "Practical Application",
            "questions": {
                "q9_1": {
                    "text": "How can you apply this understanding?",
                    "type": "multiple_selection",
                    "choices": [
                        "Practice noticing when this part activates",
                        "Use new coping strategies",
                        "Communicate needs more clearly",
                        "Set different boundaries",
                        "Practice self-compassion",
                        "Check in with parts regularly",
                        "Honor all parts' perspectives",
                        "Make decisions from core Self"
                    ]
                },
                "q9_2": {
                    "text": "What ongoing support would help?",
                    "type": "single_selection",
                    "choices": [
                        "Regular check-ins like this one",
                        "Journaling about parts",
                        "Mindfulness practices",
                        "Therapy or counseling",
                        "Support from loved ones",
                        "Creative expression",
                        "Body awareness practices",
                        "Self-compassion exercises"
                    ]
                },
                "q9_3": {
                    "text": "How has this process impacted your relationship?",
                    "type": "numerical",
                    "choices": None
                }
            }
        },
        10: {
            "focus": "Closing & Commitment",
            "questions": {
                "q10_1": {
                    "text": "What commitment would you like to make?",
                    "type": "writing",
                    "choices": None
                },
                "q10_2": {
                    "text": "What feels different now?",
                    "type": "single_selection",
                    "choices": [
                        "More understanding of this part",
                        "Greater compassion for myself",
                        "Less inner conflict",
                        "New sense of possibilities",
                        "Deeper self-awareness",
                        "More inner harmony",
                        "Clearer communication with parts",
                        "Stronger connection to core Self"
                    ]
                },
                "q10_3": {
                    "text": "How will you continue this work?",
                    "type": "single_selection",
                    "choices": [
                        "Regular parts check-ins",
                        "Applying insights to daily life",
                        "Continuing with therapy/self-work",
                        "Sharing with supportive others",
                        "Practicing new approaches",
                        "Developing self-compassion",
                        "Exploring other parts",
                        "Deepening Self-led living"
                    ]
                }
            }
        }
    }
    
    db = SessionLocal()
    try:
        # Clear existing questions
        db.query(Question).delete()
        
        # Add all questions
        for page_num, page_data in QUESTIONNAIRE_STRUCTURE.items():
            for question_id, question_data in page_data["questions"].items():
                question = Question(
                    page_number=page_num,
                    question_id=question_id,
                    question_text=question_data["text"],
                    question_type=question_data["type"],
                    choices=question_data.get("choices"),
                    focus_area=page_data["focus"]
                )
                db.add(question)
        
        db.commit()
        print("✅ Questions seeded successfully!")
        print(f"📊 Total questions added: {sum(len(page['questions']) for page in QUESTIONNAIRE_STRUCTURE.values())}")
        print(f"📄 Total pages: {len(QUESTIONNAIRE_STRUCTURE)}")
        
        # Print summary by page
        for page_num, page_data in QUESTIONNAIRE_STRUCTURE.items():
            print(f"   Page {page_num}: {page_data['focus']} - {len(page_data['questions'])} questions")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding questions: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_questions()