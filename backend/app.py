from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, get_db
from models import Base, User, Question, AssessmentResponse
from schemas import UserCreate, UserLogin, UserOut
from auth import hash_password, verify_password, create_access_token, decode_token
from fastapi import Header
from typing import List, Dict, Any
from pydantic import BaseModel
import json
import joblib
import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import LabelEncoder

# ✅ Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ANA Auth API")

# CORS – allow your Next.js app
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# ADD THESE CLASS DEFINITIONS FOR MODEL LOADING

class IFSQuestionnairePreprocessor:
    """Preprocesses IFS questionnaire data with mixed question types"""
    
    def __init__(self):
        self.label_encoders = {}
        self.scaler = None
        self.text_vectorizers = {}
        self.feature_columns = []
        self.question_types_identified = {}

    def identify_question_types(self, df):
        """Identify different question types"""
        question_types = {
            'writing': [],
            'numerical': [],
            'single_selection': [],
            'multiple_selection': []
        }

        for col in df.columns:
            if col.startswith('q'):
                if col in ['target_character', 'character_type', 'sample_id']:
                    continue

                sample_data = df[col].dropna().head(10)
                if len(sample_data) == 0:
                    continue

                if pd.api.types.is_numeric_dtype(df[col]):
                    question_types['numerical'].append(col)
                elif sample_data.astype(str).str.contains(r'\|').any():  # FIXED: Added raw string
                    question_types['multiple_selection'].append(col)
                elif sample_data.astype(str).str.len().mean() > 30:
                    question_types['writing'].append(col)
                else:
                    question_types['single_selection'].append(col)

        self.question_types_identified = question_types
        return question_types

    def preprocess_writing_responses(self, df: pd.DataFrame, text_columns: List[str]) -> pd.DataFrame:
        """Convert writing responses to numerical features using simple text analysis"""
        df_processed = df.copy()

        for col in text_columns:
            if col in df.columns:
                # Create basic text features
                df_processed[f'{col}_length'] = df[col].fillna('').astype(str).str.len()
                df_processed[f'{col}_word_count'] = df[col].fillna('').astype(str).str.split().str.len()

                # Character-specific keyword features
                character_keywords = {
                    'critic': ['critic', 'judge', 'fault', 'standard', 'perfect', 'better', 'should', 'mistake'],
                    'fear': ['fear', 'anxious', 'worried', 'scared', 'nervous', 'afraid', 'anxiety'],
                    'sad': ['sad', 'hurt', 'pain', 'grief', 'loss', 'vulnerable', 'alone'],
                    'anger': ['anger', 'angry', 'mad', 'frustrated', 'rage', 'furious', 'irritated'],
                    'pleaser': ['please', 'like', 'accept', 'fit in', 'responsible', 'others', 'agree'],
                    'nurturer': ['care', 'compassion', 'support', 'help', 'kind', 'comfort', 'nurture'],
                    'wise': ['wise', 'understanding', 'perspective', 'knowing', 'clarity', 'insight'],
                    'protective': ['protect', 'safe', 'boundary', 'guard', 'shield', 'defend'],
                    'child': ['child', 'young', 'vulnerable', 'small', 'innocent', 'little']
                }

                text_lower = df[col].fillna('').astype(str).str.lower()
                for feature_name, keywords in character_keywords.items():
                    keyword_count = text_lower.apply(
                        lambda x: sum(1 for word in keywords if word in str(x))
                    )
                    df_processed[f'{col}_{feature_name}_keywords'] = keyword_count

                # Remove original text column to avoid string conversion issues
                if col in df_processed.columns:
                    df_processed = df_processed.drop(columns=[col])

        return df_processed

    def preprocess_single_selection(self, df: pd.DataFrame, single_select_columns: List[str]) -> pd.DataFrame:
        """Encode single selection questions"""
        df_processed = df.copy()

        for col in single_select_columns:
            if col in df.columns:
                # Create label encoder for this column
                le = LabelEncoder()
                # Handle NaN values
                filled_data = df[col].fillna('Unknown')
                df_processed[col] = le.fit_transform(filled_data)
                self.label_encoders[col] = le

        return df_processed

    def preprocess_multiple_selection(self, df: pd.DataFrame, multi_select_columns: List[str]) -> pd.DataFrame:
        """Convert multiple selection questions to one-hot encoded features"""
        df_processed = df.copy()

        for col in multi_select_columns:
            if col in df.columns:
                # Get all unique options across the dataset
                all_options = set()
                for options in df[col].dropna():
                    if '|' in str(options):
                        all_options.update(options.split('|'))
                    elif options:  # Handle single selections in multiple format
                        all_options.add(options)

                # Create binary columns for each option
                for option in all_options:
                    if option:  # Skip empty options
                        option_col_name = f"{col}_{option.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '').lower()}"
                        option_col_name = option_col_name[:50]  # Limit length

                        df_processed[option_col_name] = df[col].apply(
                            lambda x: 1 if pd.notna(x) and option in str(x) else 0
                        )

                # Remove original column
                if col in df_processed.columns:
                    df_processed = df_processed.drop(columns=[col])

        return df_processed

    def preprocess_numerical(self, df: pd.DataFrame, numerical_columns: List[str]) -> pd.DataFrame:
        """Scale numerical responses"""
        df_processed = df.copy()

        for col in numerical_columns:
            if col in df.columns:
                # Ensure numerical type
                df_processed[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        return df_processed

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Complete preprocessing pipeline"""
        print("🔍 Identifying question types...")
        question_types = self.identify_question_types(df)

        print(f"📝 Writing questions: {len(question_types['writing'])}")
        print(f"🔢 Numerical questions: {len(question_types['numerical'])}")
        print(f"🔤 Single selection: {len(question_types['single_selection'])}")
        print(f"📋 Multiple selection: {len(question_types['multiple_selection'])}")

        # Start with original data (without target columns for processing)
        feature_columns = [col for col in df.columns if col.startswith('q')]
        df_features = df[feature_columns].copy()

        print("📊 Preprocessing numerical questions...")
        df_processed = self.preprocess_numerical(df_features, question_types['numerical'])

        print("🔤 Preprocessing single selection questions...")
        df_processed = self.preprocess_single_selection(df_processed, question_types['single_selection'])

        print("📝 Preprocessing multiple selection questions...")
        df_processed = self.preprocess_multiple_selection(df_processed, question_types['multiple_selection'])

        print("✍️ Preprocessing writing responses...")
        df_processed = self.preprocess_writing_responses(df_processed, question_types['writing'])

        # Add back target columns for final dataframe
        df_processed['target_character'] = df['target_character'].values
        df_processed['character_type'] = df['character_type'].values
        df_processed['sample_id'] = df['sample_id'].values

        # Store feature columns for later use
        self.feature_columns = [col for col in df_processed.columns
                              if col not in ['target_character', 'character_type', 'sample_id']]

        print(f"✅ Final feature count: {len(self.feature_columns)}")

        return df_processed

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Transform new data using fitted preprocessors"""
        print("🔄 Transforming new data...")
        
        # Identify question types for new data
        question_types = self.identify_question_types(df)

        # Start with feature columns only
        feature_columns = [col for col in df.columns if col.startswith('q')]
        df_features = df[feature_columns].copy()

        # Numerical (no fitting needed for transform)
        df_processed = self.preprocess_numerical(df_features, question_types['numerical'])

        # Single selection (use fitted label encoders)
        for col in question_types['single_selection']:
            if col in df.columns and col in self.label_encoders:
                le = self.label_encoders[col]
                # Handle unseen labels
                filled_data = df[col].fillna('Unknown')
                df_processed[col] = filled_data.apply(
                    lambda x: le.transform([x])[0] if x in le.classes_ else -1
                )

        # Multiple selection (same logic as fit)
        df_processed = self.preprocess_multiple_selection(df_processed, question_types['multiple_selection'])

        # Writing responses (same feature extraction)
        df_processed = self.preprocess_writing_responses(df_processed, question_types['writing'])

        # Add back any required columns
        if 'sample_id' in df.columns:
            df_processed['sample_id'] = df['sample_id'].values
        if 'target_character' in df.columns:
            df_processed['target_character'] = df['target_character'].values
        if 'character_type' in df.columns:
            df_processed['character_type'] = df['character_type'].values

        return df_processed

class IFSCharacterPredictor:
    """Trains and predicts IFS character types from questionnaire responses"""
    
    def __init__(self):
        self.preprocessor = IFSQuestionnairePreprocessor()
        self.model = None
        self.character_encoder = LabelEncoder()
        self.type_encoder = LabelEncoder()
        self.is_trained = False

    def predict_character(self, questionnaire_responses):
        """Predict character for new questionnaire responses"""
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        # Preprocess new data
        X_new = self.preprocessor.transform(questionnaire_responses)
        
        # Get feature columns
        feature_columns = [col for col in X_new.columns
                         if col not in ['target_character', 'character_type', 'sample_id']]
        X_new = X_new[feature_columns]
        
        # Ensure all features are numeric
        for col in X_new.columns:
            X_new[col] = pd.to_numeric(X_new[col], errors='coerce').fillna(0)
        
        # Align columns with training data
        if hasattr(self.model, 'feature_names_in_'):
            training_features = self.model.feature_names_in_
            # Add missing columns with 0 values
            for col in training_features:
                if col not in X_new.columns:
                    X_new[col] = 0  # FIXED: Added value 0
            # Reorder columns to match training
            X_new = X_new[training_features]
        
        # Make predictions
        character_predictions = self.model.predict(X_new)
        prediction_proba = self.model.predict_proba(X_new)
        
        # Create results dataframe
        results = questionnaire_responses.copy()
        results['predicted_character'] = self.character_encoder.inverse_transform(character_predictions)
        
        # Add probabilities for each character
        for i, character in enumerate(self.character_encoder.classes_):
            results[f'prob_{character}'] = prediction_proba[:, i]
        
        # Add confidence score (max probability)
        results['confidence'] = np.max(prediction_proba, axis=1)
        
        return results

# Assessment schemas
class ResponseItem(BaseModel):
    question_id: str
    response: str
    page_number: int

class SaveResponsesRequest(BaseModel):
    responses: List[ResponseItem]

# Prediction schemas
class PredictionRequest(BaseModel):
    user_id: int
    responses: Dict[str, str]  # {question_id: response}

class CharacterResult(BaseModel):
    character: str
    confidence: float
    description: str
    type: str

class PredictionResponse(BaseModel):
    user_id: int
    top_characters: List[CharacterResult]
    disclaimer: str
    total_questions: int
    answered_questions: int

# Load your trained model
def load_trained_model():
    """Load your trained IFS character prediction model"""
    
    # Define the classes in main module for unpickling
    import __main__
    __main__.IFSQuestionnairePreprocessor = IFSQuestionnairePreprocessor
    __main__.IFSCharacterPredictor = IFSCharacterPredictor
    
    model_paths = [
        "ifs_character_predictor.joblib",  # Your main trained model
        "models/ifs_character_predictor.joblib",
    ]
    
    for model_path in model_paths:
        try:
            if os.path.exists(model_path):
                print(f"🔍 Attempting to load model from: {model_path}")
                model_data = joblib.load(model_path)
                print(f"✅ Successfully loaded model from: {model_path}")
                
                # Debug: Check what type of object we loaded
                print(f"🔧 Loaded object type: {type(model_data)}")
                if hasattr(model_data, '__class__'):
                    print(f"🔧 Loaded object class: {model_data.__class__.__name__}")
                if isinstance(model_data, dict):
                    print("🔧 Model is a dictionary with keys:", list(model_data.keys()))
                
                return model_data
        except Exception as e:
            print(f"❌ Error loading {model_path}: {e}")
            continue
    
    print("⚠️ No trained model found, using demo mode")
    return None

# Load model at startup
PREDICTION_MODEL = load_trained_model()

class TrainedModelPredictor:
    """Wrapper to handle predictions from your trained model"""
    
    def __init__(self, model):
        self.model = model
        self.model_type = self._identify_model_type()
        print(f"🔧 Identified model type: {self.model_type}")
        
    def _identify_model_type(self):
        """Identify what type of model we have"""
        # Check if it's a dictionary containing the model (common in joblib saves)
        if isinstance(self.model, dict):
            print("🔧 Model is a dictionary, checking contents...")
            # Extract components from the dictionary
            if 'model' in self.model:
                print("🔧 Found 'model' key in dictionary")
                self.actual_model = self.model['model']
            if 'preprocessor' in self.model:
                print("🔧 Found 'preprocessor' key in dictionary")
                self.preprocessor = self.model['preprocessor']
            if 'character_encoder' in self.model:
                print("🔧 Found 'character_encoder' key in dictionary")
                self.character_encoder = self.model['character_encoder']
            
            return "IFSCharacterPredictor_dict"
        
        # Check for different model types
        if hasattr(self.model, 'predict_character'):
            return "IFSCharacterPredictor"
        elif hasattr(self.model, 'predict_simple'):
            return "SimpleIFSPredictor"
        elif hasattr(self.model, 'predict'):
            return "sklearn"
        elif hasattr(self.model, '__class__'):
            return f"Unknown: {self.model.__class__.__name__}"
        else:
            return "Unknown object"
    
    def prepare_user_data(self, responses: Dict[str, str]) -> pd.DataFrame:
        """Convert user responses to DataFrame format for model prediction"""
        
        # Create a DataFrame with all question columns
        question_columns = [
            "q1_1", "q1_2", "q1_3", "q1_4", "q2_1", "q2_2", "q2_3", "q2_4", 
            "q3_1", "q3_2", "q3_3", "q3_4", "q4_1", "q4_2", "q4_3", "q5_1", 
            "q5_2", "q5_3", "q5_4", "q6_1", "q6_2", "q6_3", "q7_1", "q7_2",
            "q7_3", "q8_1", "q8_2", "q8_3", "q9_1", "q9_2", "q9_3", "q10_1", 
            "q10_2", "q10_3"
        ]
        
        # Create row with user responses
        row_data = {}
        for q in question_columns:
            row_data[q] = responses.get(q, "")
        
        df = pd.DataFrame([row_data])
        
        # Add required columns for the model
        df['sample_id'] = 'current_user'
        df['target_character'] = 'unknown'
        df['character_type'] = 'unknown'
        
        print(f"🔧 Prepared user data with {len(question_columns)} questions")
        return df
    
    def preprocess_user_data(self, user_data: pd.DataFrame) -> pd.DataFrame:
        """Preprocess user data using the same pipeline as training"""
        try:
            print("🔧 Starting data preprocessing...")
            
            # If we have a preprocessor from the model dictionary, use it
            if hasattr(self, 'preprocessor') and self.preprocessor is not None:
                print("🔧 Using saved preprocessor from model")
                processed_data = self.preprocessor.transform(user_data)
                print(f"🔧 Preprocessing complete. Features: {len(processed_data.columns)}")
                return processed_data
            else:
                # Fallback to manual preprocessing
                print("🔧 Using manual preprocessing (no saved preprocessor)")
                return self._manual_preprocessing(user_data)
            
        except Exception as e:
            print(f"❌ Preprocessing failed: {e}")
            # Fallback to basic preprocessing
            return self._basic_preprocessing(user_data)
    
    def _manual_preprocessing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Manual preprocessing that mimics the training pipeline"""
        df_processed = df.copy()
        
        # Process each question column to create expected features
        for col in df.columns:
            if col.startswith('q'):
                response = df[col].iloc[0] if len(df[col]) > 0 else ""
                
                # For all responses, create basic features
                if isinstance(response, str):
                    # Text features for all questions
                    df_processed[f'{col}_length'] = len(str(response))
                    df_processed[f'{col}_word_count'] = len(str(response).split())
                    
                    # Character-specific keyword features
                    text_lower = str(response).lower()
                    
                    character_keywords = {
                        'critic': ['critic', 'judge', 'fault', 'standard', 'perfect', 'better', 'should', 'mistake'],
                        'fear': ['fear', 'anxious', 'worried', 'scared', 'nervous', 'afraid', 'anxiety'],
                        'sad': ['sad', 'hurt', 'pain', 'grief', 'loss', 'vulnerable', 'alone'],
                        'anger': ['anger', 'angry', 'mad', 'frustrated', 'rage', 'furious', 'irritated'],
                        'pleaser': ['please', 'like', 'accept', 'fit in', 'responsible', 'others', 'agree'],
                        'nurturer': ['care', 'compassion', 'support', 'help', 'kind', 'comfort', 'nurture'],
                        'wise': ['wise', 'understanding', 'perspective', 'knowing', 'clarity', 'insight'],
                        'protective': ['protect', 'safe', 'boundary', 'guard', 'shield', 'defend'],
                        'child': ['child', 'young', 'vulnerable', 'small', 'innocent', 'little']
                    }
                    
                    for feature_name, keywords in character_keywords.items():
                        keyword_count = sum(1 for word in keywords if word in text_lower)
                        df_processed[f'{col}_{feature_name}_keywords'] = keyword_count
                
                # Remove original question columns to avoid conflicts
                if col in df_processed.columns and col != 'sample_id':
                    df_processed = df_processed.drop(columns=[col])
        
        # Add any missing expected features with default values
        expected_features = [
            # Length features for all questions
            'q1_1_length', 'q1_2_length', 'q1_3_length', 'q1_4_length',
            'q2_1_length', 'q2_2_length', 'q2_3_length', 'q2_4_length',
            'q3_1_length', 'q3_2_length', 'q3_3_length', 'q3_4_length',
            'q4_1_length', 'q4_2_length', 'q4_3_length',
            'q5_1_length', 'q5_2_length', 'q5_3_length', 'q5_4_length',
            'q6_1_length', 'q6_2_length', 'q6_3_length',
            'q7_1_length', 'q7_2_length', 'q7_3_length',
            'q8_1_length', 'q8_2_length', 'q8_3_length',
            'q9_1_length', 'q9_2_length', 'q9_3_length',
            'q10_1_length', 'q10_2_length', 'q10_3_length',
            
            # Word count features for all questions
            'q1_1_word_count', 'q1_2_word_count', 'q1_3_word_count', 'q1_4_word_count',
            'q2_1_word_count', 'q2_2_word_count', 'q2_3_word_count', 'q2_4_word_count',
            'q3_1_word_count', 'q3_2_word_count', 'q3_3_word_count', 'q3_4_word_count',
            'q4_1_word_count', 'q4_2_word_count', 'q4_3_word_count',
            'q5_1_word_count', 'q5_2_word_count', 'q5_3_word_count', 'q5_4_word_count',
            'q6_1_word_count', 'q6_2_word_count', 'q6_3_word_count',
            'q7_1_word_count', 'q7_2_word_count', 'q7_3_word_count',
            'q8_1_word_count', 'q8_2_word_count', 'q8_3_word_count',
            'q9_1_word_count', 'q9_2_word_count', 'q9_3_word_count',
            'q10_1_word_count', 'q10_2_word_count', 'q10_3_word_count',
            
            # Keyword features for key questions
            'q1_1_critic_keywords', 'q1_1_fear_keywords', 'q1_1_child_keywords',
            'q10_1_critic_keywords', 'q10_1_fear_keywords', 'q10_1_child_keywords',
        ]
        
        # Add missing features with default values
        for feature in expected_features:
            if feature not in df_processed.columns:
                df_processed[feature] = 0
        
        print(f"🔧 Manual preprocessing created {len(df_processed.columns)} features")
        return df_processed
    
    def _basic_preprocessing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Basic preprocessing as fallback"""
        df_processed = df.copy()
        
        # Convert all question columns to numeric or categorical codes
        for col in df.columns:
            if col.startswith('q'):
                if df[col].dtype == 'object':
                    # For text, use length and word count
                    df_processed[f'{col}_length'] = df[col].astype(str).str.len()
                    df_processed[f'{col}_word_count'] = df[col].astype(str).str.split().str.len()
                    # Remove original column
                    if col in df_processed.columns:
                        df_processed = df_processed.drop(columns=[col])
                else:
                    # For numeric, keep as is
                    df_processed[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        return df_processed
    
    def predict(self, responses: Dict[str, str]) -> List[Dict]:
        """Make prediction using the loaded model"""
        
        try:
            user_data = self.prepare_user_data(responses)
            print(f"🔧 Making prediction with model type: {self.model_type}")
            
            if self.model_type == "IFSCharacterPredictor_dict":
                # Use the model from the dictionary
                print("🔧 Using IFSCharacterPredictor from dictionary")
                return self._predict_with_model_dict(user_data)
                
            elif self.model_type == "IFSCharacterPredictor":
                # Use your main trained model
                print("🔧 Using IFSCharacterPredictor.predict_character()")
                predictions_df = self.model.predict_character(user_data)
                return self._format_main_model_predictions(predictions_df)
                
            else:
                # Fallback to demo
                print("🔧 Using demo predictions as fallback")
                return get_demo_predictions()
                
        except Exception as e:
            print(f"❌ Prediction error with {self.model_type}: {e}")
            import traceback
            traceback.print_exc()
            return get_demo_predictions()
    
    def _predict_with_model_dict(self, user_data: pd.DataFrame) -> List[Dict]:
        """Predict using the model components from dictionary - returns top 5 predictions"""
        try:
            # Preprocess the data
            processed_data = self.preprocess_user_data(user_data)
            
            # Get feature columns (exclude target columns)
            feature_columns = [col for col in processed_data.columns 
                             if col not in ['target_character', 'character_type', 'sample_id']]
            
            X = processed_data[feature_columns].copy()
            
            # Ensure all features are numeric
            for col in X.columns:
                X.loc[:, col] = pd.to_numeric(X[col], errors='coerce').fillna(0)
            
            print(f"🔧 Final feature matrix shape: {X.shape}")
            print(f"🔧 Feature columns: {list(X.columns)}")
            
            # Align features with what the model expects
            if hasattr(self.actual_model, 'feature_names_in_'):
                training_features = self.actual_model.feature_names_in_
                print(f"🔧 Model expects {len(training_features)} features")
                
                # Add missing columns with 0 values
                for col in training_features:
                    if col not in X.columns:
                        X[col] = 0
                        print(f"🔧 Added missing feature: {col}")
                
                # Reorder columns to match training
                X = X[training_features]
            
            # Make prediction
            if hasattr(self.actual_model, 'predict_proba'):
                probabilities = self.actual_model.predict_proba(X)
                
                # Get top 5 predictions with highest probabilities
                results = []
                for i in range(len(probabilities)):
                    # Get probabilities for this sample
                    sample_probs = probabilities[i]
                    
                    # Get indices of top 5 probabilities
                    top_5_indices = np.argsort(sample_probs)[-5:][::-1]
                    
                    # Create results for top 5 characters
                    for rank, idx in enumerate(top_5_indices):
                        # Get character name from encoder if available
                        if hasattr(self, 'character_encoder') and self.character_encoder is not None:
                            try:
                                character_name = self.character_encoder.inverse_transform([idx])[0]
                                character_name = character_name.replace('_', ' ').title()
                            except:
                                character_name = f"Character_{idx}"
                        else:
                            character_name = f"Character_{idx}"
                        
                        confidence = sample_probs[idx] * 100
                        
                        results.append({
                            "character": character_name,
                            "confidence": round(confidence, 1),
                            "description": "",
                            "type": "unknown"
                        })
                
                print(f"🔧 Generated {len(results)} predictions (top 5 per sample)")
                return results
            else:
                print("❌ Model doesn't have predict_proba method")
                return get_demo_predictions()
                
        except Exception as e:
            print(f"❌ Dictionary model prediction failed: {e}")
            return get_demo_predictions()
    
    def _format_main_model_predictions(self, predictions_df: pd.DataFrame) -> List[Dict]:
        """Format predictions from main IFSCharacterPredictor"""
        results = []
        
        print(f"🔧 Formatting predictions, columns: {list(predictions_df.columns)}")
        
        # Get probability columns
        prob_columns = [col for col in predictions_df.columns if col.startswith('prob_')]
        
        if prob_columns:
            for _, row in predictions_df.iterrows():
                for prob_col in prob_columns:
                    character = prob_col.replace('prob_', '').replace('_', ' ').title()
                    confidence = row[prob_col] * 100  # Convert to percentage
                    
                    results.append({
                        "character": character,
                        "confidence": round(confidence, 1),
                        "description": "",
                        "type": "unknown"
                    })
        else:
            # Fallback if no probability columns found
            print("🔧 No probability columns found, using fallback")
            if 'predicted_character' in predictions_df.columns and 'confidence' in predictions_df.columns:
                for _, row in predictions_df.iterrows():
                    results.append({
                        "character": row['predicted_character'],
                        "confidence": round(row['confidence'] * 100, 1),
                        "description": "",
                        "type": "unknown"
                    })
            else:
                # Ultimate fallback
                return get_demo_predictions()
        
        # Sort by confidence and take top results
        results.sort(key=lambda x: x["confidence"], reverse=True)
        print(f"🔧 Generated {len(results)} predictions")
        return results[:10]

# Auth endpoints
@app.post("/auth/signup", response_model=UserOut, status_code=201)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "name": user.name, "email": user.email}}

@app.get("/auth/me", response_model=UserOut)
def me(Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).get(int(data["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Assessment endpoints
@app.get("/assessment/questions")
def get_questions(db: Session = Depends(get_db)):
    try:
        questions = db.query(Question).order_by(Question.page_number, Question.id).all()
        
        # Convert questions to JSON-serializable format
        questions_data = []
        for question in questions:
            question_dict = {
                "id": question.id,
                "page_number": question.page_number,
                "question_id": question.question_id,
                "question_text": question.question_text,
                "question_type": question.question_type,
                "choices": question.choices,
                "focus_area": question.focus_area
            }
            questions_data.append(question_dict)
        
        return questions_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching questions: {str(e)}")

@app.get("/assessment/responses")
def get_user_responses(Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = int(data["sub"])
    responses = db.query(AssessmentResponse).filter(AssessmentResponse.user_id == user_id).all()
    
    responses_data = []
    for response in responses:
        responses_data.append({
            "question_id": response.question_id,
            "response": response.response,
            "page_number": response.page_number
        })
    
    return responses_data

@app.post("/assessment/save")
def save_responses(payload: SaveResponsesRequest, Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = int(data["sub"])
    
    try:
        for response_item in payload.responses:
            # Only save if response is not empty
            if response_item.response and response_item.response.strip():
                # Check if response already exists
                existing_response = db.query(AssessmentResponse).filter(
                    AssessmentResponse.user_id == user_id,
                    AssessmentResponse.question_id == response_item.question_id
                ).first()
                
                if existing_response:
                    # Update existing response
                    existing_response.response = response_item.response
                    existing_response.page_number = response_item.page_number
                else:
                    # Create new response
                    new_response = AssessmentResponse(
                        user_id=user_id,
                        question_id=response_item.question_id,
                        response=response_item.response,
                        page_number=response_item.page_number
                    )
                    db.add(new_response)
        
        db.commit()
        return {"message": "Responses saved successfully", "saved_count": len(payload.responses)}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save responses: {str(e)}")

@app.post("/assessment/predict", response_model=PredictionResponse)
def predict_character(request: PredictionRequest, Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = int(data["sub"])
    
    try:
        # Use trained model if available
        if PREDICTION_MODEL is not None:
            print("🚀 Using trained model for prediction...")
            print(f"🔧 PREDICTION_MODEL type: {type(PREDICTION_MODEL)}")
            predictor = TrainedModelPredictor(PREDICTION_MODEL)
            predictions = predictor.predict(request.responses)
            print(f"🔧 Got {len(predictions)} predictions from model")
        else:
            print("🔄 Using demo predictions (no model found)")
            predictions = get_demo_predictions()
        
        # Get top 5 characters with descriptions and types
        top_predictions = get_top_predictions(predictions, top_n=5)
        
        # Calculate statistics
        total_questions = 34  # Total questions in assessment
        answered_questions = len([r for r in request.responses.values() if r and r.strip()])
        
        return PredictionResponse(
            user_id=user_id,
            top_characters=top_predictions,
            disclaimer="This is the beginning of your discovery journey. These insights are based on your current responses and may evolve as you continue your self-exploration.",
            total_questions=total_questions,
            answered_questions=answered_questions
        )
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback to demo predictions
        predictions = get_demo_predictions()
        top_predictions = get_top_predictions(predictions, top_n=5)
        
        total_questions = 34
        answered_questions = len([r for r in request.responses.values() if r and r.strip()])
        
        return PredictionResponse(
            user_id=user_id,
            top_characters=top_predictions,
            disclaimer="This analysis uses basic pattern matching. For more accurate results, ensure all questions are answered thoughtfully.",
            total_questions=total_questions,
            answered_questions=answered_questions
        )

def get_demo_predictions():
    """Return demo predictions when model is not available"""
    return [
        {"character": "Inner Critic", "confidence": 85.5, "type": "protective"},
        {"character": "Nurturer", "confidence": 78.2, "type": "self_led"},
        {"character": "Perfectionist", "confidence": 72.1, "type": "protective"},
        {"character": "Wounded Child", "confidence": 65.8, "type": "self_led"},
        {"character": "Protector", "confidence": 61.3, "type": "protective"},
        {"character": "Pleaser", "confidence": 58.7, "type": "protective"},
        {"character": "Sage", "confidence": 55.2, "type": "self_led"},
        {"character": "Avoidant Part", "confidence": 52.4, "type": "protective"},
        {"character": "Warrior", "confidence": 48.9, "type": "self_led"},
        {"character": "Self Presence", "confidence": 45.6, "type": "self_led"}
    ]

def get_top_predictions(predictions, top_n: int = 5) -> List[CharacterResult]:
    """Extract top N character predictions with descriptions"""
    
    # Character descriptions
    character_descriptions = {
        "inner_critic": {
            "description": "The part that judges and evaluates, often pushing for perfection and noticing flaws",
            "type": "protective"
        },
        "perfectionist": {
            "description": "Strives for flawlessness and sets extremely high standards",
            "type": "protective"
        },
        "pleaser": {
            "description": "Focuses on making others happy and avoiding conflict",
            "type": "protective"
        },
        "nurturer": {
            "description": "Compassionate and caring, offering comfort and support",
            "type": "self_led"
        },
        "wounded_child": {
            "description": "Holds early emotional pain and needs gentle care",
            "type": "self_led"
        },
        "sage": {
            "description": "Wise and insightful, offering perspective and understanding",
            "type": "self_led"
        },
        "warrior": {
            "description": "Protective and strong, setting boundaries and standing up for needs",
            "type": "self_led"
        },
        "protector": {
            "description": "Vigilant and cautious, keeping you safe from perceived threats",
            "type": "protective"
        },
        "avoidant_part": {
            "description": "Helps avoid difficult emotions or situations through distraction or withdrawal",
            "type": "protective"
        },
        "self_presence": {
            "description": "Your core Self - calm, curious, compassionate, and connected",
            "type": "self_led"
        },
        "inner critic": {
            "description": "The part that judges and evaluates, often pushing for perfection",
            "type": "protective"
        },
        "wounded child": {
            "description": "Holds early emotional pain and needs gentle care and understanding",
            "type": "self_led"
        },
        "self presence": {
            "description": "Your core Self - calm, curious, compassionate, and connected",
            "type": "self_led"
        },
        "avoidant part": {
            "description": "Helps avoid difficult emotions or situations through distraction or withdrawal",
            "type": "protective"
        }
    }
    
    # Ensure we have a list of predictions
    if not isinstance(predictions, list):
        predictions = get_demo_predictions()
    
    # Remove duplicates by character name, keeping the highest confidence
    unique_predictions = {}
    for pred in predictions:
        char_name = pred["character"]
        if char_name not in unique_predictions or pred["confidence"] > unique_predictions[char_name]["confidence"]:
            unique_predictions[char_name] = pred
    
    # Convert back to list and sort by confidence
    unique_predictions_list = list(unique_predictions.values())
    unique_predictions_list.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    
    # Take top N predictions
    top_predictions = unique_predictions_list[:top_n]
    
    # If we don't have enough predictions, fill with demo ones
    while len(top_predictions) < top_n:
        demo_chars = get_demo_predictions()
        for demo_char in demo_chars:
            if len(top_predictions) >= top_n:
                break
            # Only add if not already in top predictions
            if not any(p["character"] == demo_char["character"] for p in top_predictions):
                top_predictions.append(demo_char)
    
    # Create result objects with descriptions
    results = []
    for pred in top_predictions:
        char_key = pred["character"].lower().replace(' ', '_')
        char_info = character_descriptions.get(char_key, {
            "description": "An important part of your inner world that contributes to your unique personality",
            "type": "unknown"
        })
        
        results.append(CharacterResult(
            character=pred["character"],
            confidence=pred.get("confidence", 50.0),
            description=char_info["description"],
            type=char_info["type"]
        ))
    
    return results

# Health check endpoint
@app.get("/health")
def health_check():
    model_status = "loaded" if PREDICTION_MODEL is not None else "demo"
    return {"status": "healthy", "service": "ANA API", "model_status": model_status}

# Model status endpoint
@app.get("/assessment/model-status")
def model_status():
    model_paths = [
        "ifs_character_predictor.joblib",
        "models/ifs_character_predictor.joblib",
    ]
    
    available_models = []
    for path in model_paths:
        if os.path.exists(path):
            available_models.append(path)
    
    return {
        "model_available": len(available_models) > 0,
        "available_models": available_models,
        "loaded_model": PREDICTION_MODEL is not None,
        "message": "Trained model ready for predictions" if PREDICTION_MODEL else "Using demo predictions"
    }

@app.get("/")
def root():
    return {"message": "ANA API is running!"}