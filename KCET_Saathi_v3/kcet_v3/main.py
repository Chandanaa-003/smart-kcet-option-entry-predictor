import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
import httpx

load_dotenv()

app = FastAPI(title="KCET Saathi Backend")

class ChatRequest(BaseModel):
    system: str
    messages: list

@app.post("/api/chat")
async def chat_with_claude(request: ChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set on the server")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": "claude-3-opus-20240229", # Using standard available model since sonnet-4 may not be active
                    "max_tokens": 350,
                    "system": request.system,
                    "messages": request.messages
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            
            if "content" not in data or len(data["content"]) == 0:
                raise HTTPException(status_code=500, detail="Empty response from Claude")
                
            return {"reply": data["content"][0]["text"]}

        except httpx.HTTPStatusError as e:
            error_details = e.response.json()
            raise HTTPException(status_code=e.response.status_code, detail=error_details.get("error", {}).get("message", "Unknown Anthropic Error"))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# Mount the static directory to serve index.html, css, js, and data.
# The html=True flag allows it to serve index.html when root / is accessed.
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
