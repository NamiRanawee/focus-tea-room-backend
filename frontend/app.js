// --- Theme Switcher ---
document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
        const color = e.target.getAttribute('data-color');
        document.documentElement.style.setProperty('--primary', color);
        document.documentElement.style.setProperty('--primary-soft', color + '20'); // 20% opacity
    });
});

// --- Clock Engine ---
function updateClocks() {
    const now = new Date();
    document.getElementById('digital-time').innerText = 
        `${now.toLocaleTimeString('en-US')} • ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    
    const secs = now.getSeconds();
    const mins = now.getMinutes();
    const hours = now.getHours();
    document.getElementById('hand-sec').style.transform = `translateX(-50%) rotate(${secs * 6}deg)`;
    document.getElementById('hand-min').style.transform = `translateX(-50%) rotate(${mins * 6}deg)`;
    document.getElementById('hand-hour').style.transform = `translateX(-50%) rotate(${hours * 30 + (mins / 2)}deg)`;
}
setInterval(updateClocks, 1000);
updateClocks();

// --- Audio Synthesizer ---
let chimeEnabled = true;
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

document.getElementById('btn-chime').addEventListener('click', (e) => {
    chimeEnabled = !chimeEnabled;
    e.target.classList.toggle('active', chimeEnabled);
    e.target.innerText = chimeEnabled ? '🔔 Chime: ON' : '🔕 Chime: OFF';
});

function playChime() {
    if (!chimeEnabled) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    osc.start();
    osc.stop(ctx.currentTime + 1);
}

// Rain Audio Synthesizer
let noiseNode = null;
document.getElementById('btn-rain').addEventListener('click', (e) => {
    const ctx = getAudioContext();
    if (noiseNode) {
        noiseNode.stop();
        noiseNode = null;
        e.target.classList.remove('active');
        return;
    }
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.1;
    }
    
    noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    noiseNode.connect(filter);
    filter.connect(ctx.destination);
    noiseNode.start();
    e.target.classList.add('active');
});

// --- Timer & Teapot Animation Engine ---
let timerInterval = null;
let currentDuration = 25;
let timeLeft = currentDuration * 60;
let isRunning = false;

const teaContainer = document.getElementById('tea-container');

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (isRunning) return;
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
    teaContainer.classList.add('brewing'); // Triggers steam animation
    
    clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
        if (timeLeft > 0) {
            timeLeft--;
            document.getElementById('time-display').innerText = formatTime(timeLeft);
        } else {
            clearInterval(timerInterval);
            isRunning = false;
            teaContainer.classList.remove('brewing');
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
    teaContainer.classList.remove('brewing');
    document.getElementById('status-badge').innerText = "PAUSED / READY";
});

document.getElementById('reset-btn').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
    teaContainer.classList.remove('brewing');
    timeLeft = currentDuration * 60;
    document.getElementById('time-display').innerText = formatTime(timeLeft);
    document.getElementById('status-badge').innerText = "PAUSED / READY";
});

// --- Tasks CRUD ---
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

async function fetchTodos() {
    const res = await fetch('/api/todos/today');
    if (!res.ok) return;
    const tasks = await res.json();
    todoList.innerHTML = '';
    
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
        div.querySelector('.task-left').addEventListener('click', async () => {
            await fetch(`/api/todos/${task.id}`, { method: 'PUT' });
            fetchTodos();
        });
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

// --- Brew Log Stats ---
async function fetchStats() {
    const logRes = await fetch('/api/sessions/today');
    const logBody = document.getElementById('brew-log-body');
    logBody.innerHTML = '';
    if (logRes.ok) {
        const sessions = await logRes.json();
        sessions.forEach(s => {
            logBody.innerHTML += `<tr><td>${s.created_time}</td><td>${s.duration_minutes}m</td><td><span class="badge">${s.status}</span></td></tr>`;
        });
    }

    const statRes = await fetch('/api/sessions/stats');
    if (statRes.ok) {
        const stats = await statRes.json();
        document.getElementById('accum-day').innerText = `${Math.floor(stats.day_mins / 60)}h ${stats.day_mins % 60}m`;
        document.getElementById('cups-count').innerText = `${stats.today_cups}/4`;
        document.getElementById('cups-left').innerText = `${Math.max(0, 4 - stats.today_cups)} cups left`;
    }
}

fetchTodos();
fetchStats();