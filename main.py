from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import sqlite3
from datetime import datetime, date

# Initialize Database for Tasks
def init_todo_db():
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
    conn.commit()
    conn.close()

init_todo_db()

app = FastAPI(title="Focus Tea Room API")

# --- Pydantic Models ---
class TaskCreate(BaseModel):
    task: str

class TaskResponse(BaseModel):
    id: int
    task: str
    completed: bool
    created_date: str

# --- Endpoints ---
@app.post("/api/todos", response_model=TaskResponse)
def add_todo(payload: TaskCreate):
    # Note: Pass your current_user dependency here to lock to user_id
    today = date.today().isoformat()
    conn = sqlite3.connect("todos.db")
    c = conn.cursor()
    c.execute("INSERT INTO tasks (user_id, task, completed, created_date) VALUES (?, ?, ?, ?)", 
              (1, payload.task, 0, today))
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
    # Fetch everything BEFORE today, ordered by newest first
    c.execute("SELECT id, task, completed, created_date FROM tasks WHERE created_date < ? ORDER BY created_date DESC", (today,))
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