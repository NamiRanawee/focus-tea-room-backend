// --- Theme Switcher ---
document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
        const color = e.target.getAttribute('data-color');
        document.documentElement.style.setProperty('--primary', color);
        document.documentElement.style.setProperty('--primary-soft', color + '20'); // 20% opacity
    });
});

// --- Clock Logic ---
function updateClocks() {
    const now = new Date();
    // Digital
    document.getElementById('digital-time').innerText = 
        `${now.toLocaleTimeString('en-US')} • ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    // Analog
    const secs = now.getSeconds();
    const mins = now.getMinutes();
    const hours = now.getHours();
    document.getElementById('hand-sec').style.transform = `translateX(-50%) rotate(${secs * 6}deg)`;
    document.getElementById('hand-min').style.transform = `translateX(-50%) rotate(${mins * 6}deg)`;
    document.getElementById('hand-hour').style.transform = `translateX(-50%) rotate(${hours * 30 + (mins / 2)}deg)`;
}
setInterval(updateClocks, 1000);
updateClocks();

// --- Audio Synthesizer (No downloads needed!) ---
let chimeEnabled = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

document.getElementById('btn-chime').addEventListener('click', (e) => {
    chimeEnabled = !chimeEnabled;
    e.target.classList.toggle('active', chimeEnabled);
    e.target.innerText = chimeEnabled ? '🔔 Chime: ON' : '🔕 Chime: OFF';
});

function playChime() {
    if (!chimeEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
    osc.start(); osc.stop(audioCtx.currentTime + 1);
}

// Rain Generator
let noiseNode;
document.getElementById('btn-rain').addEventListener('click', (e) => {
    if (noiseNode) {
        noiseNode.stop(); noiseNode = null;
        e.target.classList.remove('active');
        return;
    }
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.1; // Soft white noise
    
    noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800; // Muffles noise to sound like rain
    
    noiseNode.connect(filter);
    filter.connect(audioCtx.destination);
    noiseNode.start();
    e.target.classList.add('active');
});

// --- Timer Logic ---
let timerInterval = null;
let currentDuration = 25; // default 25m
let timeLeft = currentDuration * 60;
let isRunning = false;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if(isRunning) return;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentDuration = parseInt(e.target.getAttribute('data-time'));
        timeLeft = currentDuration * 60;
        document.getElementById('time-display').innerText = formatTime(timeLeft);
        document.getElementById('stage-text').innerText = `Stage ${currentDuration <= 25 ? '1' : '2'}: Warming Kettle`;
    });
});

document.getElementById('start-btn').addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById('status-badge').innerText = "BREWING FOCUS...";
    
    clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
        if (timeLeft > 0) {
            timeLeft--;
            document.getElementById('time-display').innerText = formatTime(timeLeft);
        } else {
            clearInterval(timerInterval);
            isRunning = false;
            playChime();
            document.getElementById('status-badge').innerText = "SESSION COMPLETE!";
            await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ duration_minutes: currentDuration, status: 'Complete' })
            });
            fetchStats();
        }
    }, 1000);
});

document.getElementById('pause-btn').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
    document.getElementById('status-badge').innerText = "PAUSED / READY";
});

document.getElementById('reset-btn').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
    timeLeft = currentDuration * 60;
    document.getElementById('time-display').innerText = formatTime(timeLeft);
    document.getElementById('status-badge').innerText = "PAUSED / READY";
});

// --- Tasks Logic ---
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

async function fetchTodos() {
    const res = await fetch('/api/todos/today');
    const tasks = await res.json();
    todoList.innerHTML = '';
    
    // Calculate how many are checked for the Archive counter
    const completedCount = tasks.filter(t => t.completed).length;
    document.getElementById('archive-count').innerText = completedCount;

    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div class="task-left">
                <div class="task-checkbox"></div>
                <span>${task.task}</span>
            </div>
            <button class="btn-delete">x</button>
        `;
        // Toggle complete
        div.querySelector('.task-left').addEventListener('click', async () => {
            await fetch(`/api/todos/${task.id}`, { method: 'PUT' });
            fetchTodos();
        });
        // Delete completely
        div.querySelector('.btn-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            await fetch(`/api/todos/${task.id}`, { method: 'DELETE' });
            fetchTodos();
        });
        todoList.appendChild(div);
    });
}

document.getElementById('add-todo-btn').addEventListener('click', async () => {
    if (!todoInput.value.trim()) return;
    await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: todoInput.value.trim() })
    });
    todoInput.value = '';
    fetchTodos();
});

// --- Stats & Brew Log Logic ---
async function fetchStats() {
    const logRes = await fetch('/api/sessions/today');
    const logBody = document.getElementById('brew-log-body');
    logBody.innerHTML = '';
    if(logRes.ok) {
        const sessions = await logRes.json();
        sessions.forEach(s => {
            logBody.innerHTML += `<tr><td>${s.created_time}</td><td>${s.duration_minutes}m</td><td><span class="badge">${s.status}</span></td></tr>`;
        });
    }

    const statRes = await fetch('/api/sessions/stats');
    if(statRes.ok) {
        const stats = await statRes.json();
        document.getElementById('accum-day').innerText = `${Math.floor(stats.day_mins / 60)}h ${stats.day_mins % 60}m`;
        document.getElementById('cups-count').innerText = `${stats.today_cups}/4`;
        document.getElementById('cups-left').innerText = `${Math.max(0, 4 - stats.today_cups)} cups left`;
    }
}

fetchTodos();
fetchStats();