@echo off
echo Starting KCET Saathi FastAPI Server...
echo The server will be available at http://localhost:8000
uvicorn main:app --reload --host 0.0.0.0 --port 8000
