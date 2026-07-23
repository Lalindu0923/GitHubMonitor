import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env explicitly
load_dotenv(dotenv_path="d:/SLT/AI/GitHubMonitor-v2/Ai_Server/.env")

api_key = os.getenv("GEMINI_API_KEY")
print("GEMINI_API_KEY:", api_key)

if not api_key:
    print("No GEMINI_API_KEY found!")
else:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content("Review commit: 'Update app.py'. Return JSON with keys: score, verdict, summary, strengths, risks, suggestions.")
        print("\nGemini Response OK:")
        print(response.text)
    except Exception as e:
        print("\nGemini Request Failed:", e)
