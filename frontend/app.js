// --- Web Crypto API End-to-End Encryption Engine ---
let activeCryptoKey = null;
let activeUsername = null;

async function deriveKey(username, pin) {
    const enc = new TextEncoder();
    const salt = enc.encode(`salt_tea_room_${username.toLowerCase()}`);
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

async function encryptData(data, key) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = enc.encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
    return { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) };
}

async function decryptData(encryptedObj, key) {
    const dec = new TextDecoder();
    const iv = new Uint8Array(encryptedObj.iv);
    const ciphertext = new Uint8Array(encryptedObj.ciphertext);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    return JSON.parse(dec.decode(decrypted));
}

let appData = { tasks: [], archivedTasks: [], sessions: [] };

async function saveUserData() {
    if (!activeUsername || !activeCryptoKey) return;
    const encrypted = await encryptData(appData, activeCryptoKey);
    localStorage.setItem(`tea_vault_${activeUsername}`, JSON.stringify(encrypted));
}

async function loadUserData() {
    const raw = localStorage.getItem(`tea_vault_${activeUsername}`);
    if (!raw) {
        appData = { tasks: [], archivedTasks: [], sessions: [] };
        await saveUserData();
        return true;
    }
    try {
        const encryptedObj = JSON.parse(raw);
        appData = await decryptData(encryptedObj, activeCryptoKey);
        // Ensure archivedTasks exists for older profiles
        if (!appData.archivedTasks) appData.archivedTasks = [];
        return true;
    } catch (e) { return false; }
}

// --- Auth Handling ---
const authModal = document.getElementById('auth-modal');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');

authSubmitBtn.addEventListener('click', async () => {
    const username = document.getElementById('auth-username').value.trim().toLowerCase();
    const pin = document.getElementById('auth-pin').value.trim();

    if (!username || !pin) { authError.innerText = "Please fill in both fields."; return; }
    
    authSubmitBtn.innerText = "Decrypting...";
    const key = await deriveKey(username, pin);
    activeUsername = username;
    activeCryptoKey = key;

    const success = await loadUserData();
    if (success) {
        authModal.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        renderAll();
    } else {
        authError.innerText = "Incorrect PIN for this username.";
    }
    authSubmitBtn.innerText = "Unlock Vault ✨";
});

logoutBtn.addEventListener('click', () => {
    activeUsername = null; activeCryptoKey = null;
    authModal.style.display = 'flex';
    logoutBtn.style.display = 'none';
    document.getElementById('auth-pin').value = '';
    document.title = "Focus Tea Room V3.0";
});

// --- Theme Switcher ---
document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
        const color = e.target.getAttribute('data-color');
        document.documentElement.style.setProperty('--primary', color);
        document.documentElement.style.setProperty('--primary-soft', color + '25');
    });
});

// --- Clocks ---
function updateClocks() {
    const now = new Date();
    document.getElementById('digital-time').innerText = `${now.toLocaleTimeString('en-US')} • ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    const secs = now.getSeconds(); const mins = now.getMinutes(); const hours = now.getHours();
    document.getElementById('hand-sec').style.transform = `translateX(-50%) rotate(${secs * 6}deg)`;
    document.getElementById('hand-min').style.transform = `translateX(-50%) rotate(${mins * 6}deg)`;
    document.getElementById('hand-hour').style.transform = `translateX(-50%) rotate(${hours * 30 + (mins / 2)}deg)`;
}
setInterval(updateClocks, 1000); updateClocks();

// --- Timer Engine ---
let timerInterval = null;
let totalDurationSeconds = 25 * 60;
let timeLeftSeconds = totalDurationSeconds;
let isRunning = false;

const teaContainer = document.getElementById('tea-container');
const teaLiquidFill = document.getElementById('tea-liquid-fill');
const timeDisplay = document.getElementById('time-display');
const congratsModal = document.getElementById('congrats-modal');
const congratsCard = document.getElementById('congrats-card');

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTeacupFill() {
    const progress = (totalDurationSeconds - timeLeftSeconds) / totalDurationSeconds;
    const height = progress * 40;
    teaLiquidFill.setAttribute('y', 75 - height);
    teaLiquidFill.setAttribute('height', height);
}

function setTimerDuration(minutes) {
    if (isRunning) return;
    totalDurationSeconds = minutes * 60;
    timeLeftSeconds = totalDurationSeconds;
    timeDisplay.innerText = formatTime(timeLeftSeconds);
    updateTeacupFill();
}

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (isRunning) return;
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        setTimerDuration(parseInt(e.target.getAttribute('data-time')));
    });
});

document.getElementById('set-custom-btn').addEventListener('click', () => {
    if (isRunning) return;
    const input = document.getElementById('custom-minutes-input');
    if (parseInt(input.value) > 0) {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        setTimerDuration(parseInt(input.value));
        input.value = '';
    }
});

document.getElementById('start-btn').addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    document.getElementById('status-badge').innerText = "BREWING FOCUS...";
    teaContainer.classList.add('brewing');
    
    clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
        if (timeLeftSeconds > 0) {
            timeLeftSeconds--;
            const formatted = formatTime(timeLeftSeconds);
            timeDisplay.innerText = formatted;
            document.title = `⏳ ${formatted} - Focus Tea Room`;
            updateTeacupFill();
        } else {
            clearInterval(timerInterval);
            isRunning = false;
            teaContainer.classList.remove('brewing');
            document.title = `✨ Done! - Focus Tea Room`;
            document.getElementById('status-badge').innerText = "SESSION COMPLETE!";
            
            // Record Session
            const now = new Date();
            appData.sessions.unshift({
                id: Date.now(),
                duration_minutes: Math.round(totalDurationSeconds / 60),
                status: 'Complete',
                timestamp: now.toISOString(),
                dateStr: now.toISOString().split('T')[0],
                timeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                monthStr: now.toLocaleString('default', { month: 'short' }),
                yearNum: now.getFullYear()
            });
            await saveUserData();
            renderStats(); renderBrewLog();
            
            congratsCard.classList.remove('pop-out');
            congratsModal.style.display = 'flex';
        }
    }, 1000);
});

document.getElementById('congrats-confirm-btn').addEventListener('click', () => {
    congratsCard.classList.add('pop-out');
    setTimeout(() => {
        congratsModal.style.display = 'none';
        timeLeftSeconds = totalDurationSeconds;
        timeDisplay.innerText = formatTime(timeLeftSeconds);
        updateTeacupFill();
        document.title = "Focus Tea Room V3.0";
        document.getElementById('status-badge').innerText = "READY TO BREW";
    }, 380);
});

document.getElementById('pause-btn').addEventListener('click', () => {
    clearInterval(timerInterval); isRunning = false;
    teaContainer.classList.remove('brewing');
    document.title = "Paused - Focus Tea Room";
    document.getElementById('status-badge').innerText = "PAUSED";
});

document.getElementById('reset-btn').addEventListener('click', () => {
    clearInterval(timerInterval); isRunning = false;
    teaContainer.classList.remove('brewing');
    timeLeftSeconds = totalDurationSeconds;
    timeDisplay.innerText = formatTime(timeLeftSeconds);
    updateTeacupFill();
    document.title = "Focus Tea Room V3.0";
    document.getElementById('status-badge').innerText = "READY TO BREW";
});

// --- Tasks & Archive ---
async function renderTodos() {
    const list = document.getElementById('todo-list'); list.innerHTML = '';
    appData.tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''}`;
        div.innerHTML = `<div class="task-left"><div class="task-checkbox"></div><span>${task.task}</span></div><button class="btn-delete" title="Pack into Archive">x</button>`;
        
        div.querySelector('.task-left').addEventListener('click', async () => { 
            task.completed = !task.completed; 
            await saveUserData(); 
            renderTodos(); 
        });
        
        // When deleted, push to archive array first
        div.querySelector('.btn-delete').addEventListener('click', async (e) => { 
            e.stopPropagation(); 
            appData.archivedTasks.unshift({ 
                ...task, 
                archivedAt: new Date().toISOString() 
            });
            appData.tasks = appData.tasks.filter(t => t.id !== task.id); 
            await saveUserData(); 
            renderTodos(); 
        });
        
        list.appendChild(div);
    });
}

document.getElementById('add-todo-btn').addEventListener('click', async () => {
    const input = document.getElementById('todo-input');
    if (!input.value.trim()) return;
    appData.tasks.push({ id: Date.now(), task: input.value.trim(), completed: false });
    input.value = ''; await saveUserData(); renderTodos();
});

// Archive Modal Logic
const archiveModal = document.getElementById('archive-modal');
document.getElementById('open-archive-btn').addEventListener('click', () => {
    renderArchive();
    archiveModal.style.display = 'flex';
});

document.getElementById('close-archive-btn').addEventListener('click', () => {
    archiveModal.style.display = 'none';
});

function renderArchive() {
    const list = document.getElementById('archive-list');
    list.innerHTML = '';
    
    if (appData.archivedTasks.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 20px 0;">No packed tasks yet! Finish some work and send them here.</div>';
        return;
    }
    
    appData.archivedTasks.forEach(task => {
        const dateStr = new Date(task.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        list.innerHTML += `
            <div class="archive-item">
                <span>${task.task}</span>
                <span class="archive-date">${dateStr}</span>
            </div>
        `;
    });
}

// --- Statistics ---
let currentPeriod = 'day';
document.querySelectorAll('#time-pills .pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
        document.querySelectorAll('#time-pills .pill').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active'); currentPeriod = e.target.getAttribute('data-period');
        renderStats();
    });
});

function renderStats() {
    const now = new Date(); const todayStr = now.toISOString().split('T')[0];
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() || 7) + 1); startOfWeek.setHours(0,0,0,0);
    let totalMins = 0;
    appData.sessions.forEach(s => {
        if (s.status !== 'Complete') return;
        const sDate = new Date(s.timestamp || s.dateStr);
        if (currentPeriod === 'day' && s.dateStr === todayStr) totalMins += s.duration_minutes;
        else if (currentPeriod === 'week' && sDate >= startOfWeek) totalMins += s.duration_minutes;
        else if (currentPeriod === 'month' && sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear()) totalMins += s.duration_minutes;
        else if (currentPeriod === 'year' && sDate.getFullYear() === now.getFullYear()) totalMins += s.duration_minutes;
    });
    document.getElementById('accum-display').innerText = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
}

function renderBrewLog() {
    const logBody = document.getElementById('brew-log-body'); logBody.innerHTML = '';
    appData.sessions.slice(0, 5).forEach(s => {
        logBody.innerHTML += `<tr><td>${s.timeStr}</td><td>${s.duration_minutes}m</td><td><span class="badge">DONE</span></td></tr>`;
    });
}
function renderAll() { renderTodos(); renderStats(); renderBrewLog(); updateTeacupFill(); }

// --- The Sink ---
document.getElementById('open-sink-btn').addEventListener('click', () => {
    const sinkTab = window.open('about:blank', '_blank'); 
    
    const monthStats = {};
    let maxFocusTime = 0;
    let maxMonthKey = null;
    let totalTeacups = 0;

    appData.sessions.forEach(s => {
        if (s.status !== 'Complete') return;
        totalTeacups++;
        const d = new Date(s.timestamp || s.dateStr);
        const mKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        
        if (!monthStats[mKey]) monthStats[mKey] = { cups: 0, time: 0 };
        monthStats[mKey].cups += 1;
        monthStats[mKey].time += s.duration_minutes;

        if (monthStats[mKey].time > maxFocusTime) {
            maxFocusTime = monthStats[mKey].time;
            maxMonthKey = mKey;
        }
    });

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>The Sink - Focus Tea Room</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap');
            body { font-family: 'Nunito', sans-serif; background: #fcfaff; color: #4b5563; padding: 40px; margin: 0; text-align: center; }
            .header-box { background: white; border-radius: 30px; padding: 30px; margin: 0 auto 30px auto; max-width: 800px; box-shadow: 0 20px 50px rgba(155, 102, 255, 0.1); border: 2px solid #ede6ff; }
            h1 { color: #9b66ff; margin: 0 0 10px 0; font-size: 32px; font-weight: 800; }
            .total-badge { display: inline-block; background: #9b66ff; color: white; padding: 10px 24px; border-radius: 25px; font-weight: 800; font-size: 18px; box-shadow: 0 8px 20px rgba(155, 102, 255, 0.3); }
            
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; max-width: 900px; margin: 0 auto; }
            .month-card { background: white; border-radius: 25px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); border: 2px solid #f3f4f6; position: relative; transition: transform 0.2s; }
            .month-card:hover { transform: translateY(-5px); border-color: #ede6ff; }
            .month-card.max-month { border-color: #9b66ff; background: #fcfaff; }
            
            .sticker { font-size: 45px; display: block; margin-bottom: 10px; }
            .month-title { font-weight: 800; font-size: 18px; color: #4b5563; margin-bottom: 5px; }
            .month-stats { font-size: 14px; color: #9ca3af; font-weight: 700; }
        </style>
    </head>
    <body>
        <div class="header-box">
            <h1>🧽 The Teacup Sink</h1>
            <p style="color: #9ca3af; font-size: 16px; margin-bottom: 20px; font-weight: 700;">Every session leaves a cup. Let's see how much you've brewed!</p>
            <div class="total-badge">Total Cups Washed: ${totalTeacups} ☕</div>
        </div>

        <div class="grid">
    `;

    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();

    monthsList.forEach(m => {
        const fullKey = `${m} ${currentYear}`;
        const stats = monthStats[fullKey] || { cups: 0, time: 0 };
        const isMax = (fullKey === maxMonthKey && stats.cups > 0);
        
        let sticker = "🕸️"; 
        if (isMax) sticker = "🛁☕☕☕"; 
        else if (stats.cups > 10) sticker = "🧼☕☕"; 
        else if (stats.cups > 0) sticker = "🧽☕"; 

        html += `
            <div class="month-card ${isMax ? 'max-month' : ''}">
                <div class="sticker">${sticker}</div>
                <div class="month-title">${m} ${currentYear}</div>
                <div class="month-stats">${stats.cups} Cups • ${Math.floor(stats.time/60)}h ${stats.time%60}m</div>
            </div>
        `;
    });

    html += `</div></body></html>`;
    
    sinkTab.document.write(html);
    sinkTab.document.close();
});