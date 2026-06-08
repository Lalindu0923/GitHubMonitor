from fastapi import FastAPI
from dotenv import load_dotenv
import os
import google.generativeai as genai

from app.routes import analyze

load_dotenv()

# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

app = FastAPI()

PORT = os.getenv("PORT")
MODEL = os.getenv("MODEL")

@app.get("/")
def home():
    return{
        "message": "Hello, World!",
        "model": MODEL
    }
    
    
app.include_router(
    analyze.router,
)