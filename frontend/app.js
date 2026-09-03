// --- Vintage Clock Logic ---
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('retro-time').innerText = timeString;
}
setInterval(updateClock, 1000);
updateClock();

// --- Timer Logic (Bug Fixed) ---
let timerInterval = null; // Global reference
let timeLeft = 25 * 60; // 25 minutes
let isRunning = false;

const timeDisplay = document.getElementById('time-display');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

document.getElementById('start-btn').addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    
    // Always clear existing interval before starting a new one
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            timeDisplay.innerText = formatTime(timeLeft);
        } else {
            clearInterval(timerInterval);
            isRunning = false;
            alert("Session complete! Time for a tea break.");
        }
    }, 1000);
});

document.getElementById('pause-btn').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
});

document.getElementById('reset-btn').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
    timeLeft = 25 * 60;
    timeDisplay.innerText = formatTime(timeLeft);
});

// --- Todo List Logic ---
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

async function fetchTodos() {
    const res = await fetch('/api/todos/today');
    const tasks = await res.json();
    renderTodos(tasks);
}

function renderTodos(tasks) {
    todoList.innerHTML = '';
    tasks.forEach(task => {
        const li = document.createElement('li');
        if (task.completed) li.classList.add('completed');
        
        li.innerHTML = `
            <span class="checkbox"></span>
            <span>${task.task}</span>
        `;
        
        li.addEventListener('click', async () => {
            await fetch(`/api/todos/${task.id}`, { method: 'PUT' });
            fetchTodos(); // Re-render immediately
        });
        
        todoList.appendChild(li);
    });
}

document.getElementById('add-todo-btn').addEventListener('click', async () => {
    const taskText = todoInput.value.trim();
    if (!taskText) return;

    await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskText })
    });
    
    todoInput.value = '';
    fetchTodos(); // Re-render to show new item instantly
});

// Initial load
fetchTodos();