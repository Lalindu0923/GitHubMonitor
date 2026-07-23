import os
from dotenv import load_dotenv
import urllib.request
import json
import time

load_dotenv()

start_time = time.time()
base_url = "http://localhost:11434/v1"
payload = {
    "model": "qwen3:8b",
    "messages": [
        {"role": "system", "content": "You are a senior AI code reviewer."},
        {"role": "user", "content": "Review commit: 'Update app.py'. Return JSON with keys: score, verdict, summary, strengths, risks, suggestions."}
    ],
    "temperature": 0.2
}

try:
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        elapsed = time.time() - start_time
        print(f"\nqwen3:8b Response OK in {elapsed:.2f}s:")
        print(res_data["choices"][0]["message"]["content"])
except Exception as e:
    print("\nRequest Failed:", e)
