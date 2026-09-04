import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Focus Tea Room V3.0")

# Mount Static Frontend Files
# This serves your index.html, styles.css, and app.js from the "frontend" folder
if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
else:
    print("Warning: 'frontend' directory not found. Make sure your HTML/CSS/JS files are in a folder named 'frontend' right next to server.py.")

if __name__ == "__main__":
    import uvicorn
    # The string must be "server:app" (filename without .py : FastAPI instance name)
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)