import os
import sqlite3
from datetime import date, datetime
from typing import List

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Focus Tea Room V2.0 API")

# Initialize Database Tables
def init_db():
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            task TEXT NOT NULL,
            completed BOOLEAN NOT NULL CHECK (completed IN (0, 1)),
            created_date TEXT NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            duration_minutes INTEGER,
            status TEXT,
            created_date TEXT NOT NULL,
            created_time TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Pydantic Schemas
class TaskCreate(BaseModel):
    task: str

class TaskResponse(BaseModel):
    id: int
    task: str
    completed: bool
    created_date: str

class SessionCreate(BaseModel):
    duration_minutes: int
    status: str

class SessionResponse(BaseModel):
    id: int
    duration_minutes: int
    status: str
    created_date: str
    created_time: str

# Tasks API
@app.post("/api/todos", response_model=TaskResponse)
def add_todo(payload: TaskCreate):
    today = date.today().isoformat()
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("INSERT INTO tasks (user_id, task, completed, created_date) VALUES (?, ?, ?, ?)", (1, payload.task, 0, today))
    task_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": task_id, "task": payload.task, "completed": False, "created_date": today}

@app.get("/api/todos/today", response_model=List[TaskResponse])
def get_todays_todos():
    today = date.today().isoformat()
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("SELECT id, task, completed, created_date FROM tasks WHERE created_date = ?", (today,))
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "task": r[1], "completed": bool(r[2]), "created_date": r[3]} for r in rows]

@app.get("/api/todos/archive", response_model=List[TaskResponse])
def get_archived_todos():
    today = date.today().isoformat()
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("SELECT id, task, completed, created_date FROM tasks WHERE created_date < ? OR completed = 1 ORDER BY created_date DESC", (today,))
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "task": r[1], "completed": bool(r[2]), "created_date": r[3]} for r in rows]

@app.put("/api/todos/{task_id}")
def toggle_todo(task_id: int):
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("UPDATE tasks SET completed = NOT completed WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/todos/{task_id}")
def delete_todo(task_id: int):
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

# Sessions API
@app.post("/api/sessions", response_model=SessionResponse)
def add_session(payload: SessionCreate):
    today = date.today().isoformat()
    now = datetime.now().strftime("%I:%M %p")
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("INSERT INTO sessions (user_id, duration_minutes, status, created_date, created_time) VALUES (?, ?, ?, ?, ?)", 
              (1, payload.duration_minutes, payload.status, today, now))
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": session_id, "duration_minutes": payload.duration_minutes, "status": payload.status, "created_date": today, "created_time": now}

@app.get("/api/sessions/today", response_model=List[SessionResponse])
def get_todays_sessions():
    today = date.today().isoformat()
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("SELECT id, duration_minutes, status, created_date, created_time FROM sessions WHERE created_date = ? ORDER BY id DESC", (today,))
    rows = c.fetchall()
    conn.close()
    return [{"id": r[0], "duration_minutes": r[1], "status": r[2], "created_date": r[3], "created_time": r[4]} for r in rows]

@app.get("/api/sessions/stats")
def get_session_stats():
    today = date.today().isoformat()
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("SELECT SUM(duration_minutes) FROM sessions WHERE created_date = ? AND status = 'Complete'", (today,))
    today_mins = c.fetchone()[0] or 0
    c.execute("SELECT COUNT(id) FROM sessions WHERE created_date = ? AND status = 'Complete'", (today,))
    today_cups = c.fetchone()[0] or 0
    conn.close()
    return {"day_mins": today_mins, "today_cups": today_cups}

# Mount Frontend Static Files
if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")