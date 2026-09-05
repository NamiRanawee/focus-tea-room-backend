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

let appData = { tasks: [], archivedTasks: [], sessions: [], tags: [] };
let selectedTag = null; 

async function saveUserData() {
    if (!activeUsername || !activeCryptoKey) return;
    const encrypted = await encryptData(appData, activeCryptoKey);
    localStorage.setItem(`tea_vault_${activeUsername}`, JSON.stringify(encrypted));
}

async function loadUserData() {
    const raw = localStorage.getItem(`tea_vault_${activeUsername}`);
    if (!raw) {
        appData = { tasks: [], archivedTasks: [], sessions: [], tags: [] };
        await saveUserData();
        return true;
    }
    try {
        const encryptedObj = JSON.parse(raw);
        appData = await decryptData(encryptedObj, activeCryptoKey);
        if (!appData.archivedTasks) appData.archivedTasks = [];
        if (!appData.tags) appData.tags = [];
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
    document.title = "Focus Tea Room V3.5";
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

// --- Tags Engine ---
function renderTags() {
    const list = document.getElementById('tags-list');
    list.innerHTML = '';
    appData.tags.forEach(tag => {
        const div = document.createElement('div');
        const isActive = selectedTag && selectedTag.id === tag.id;
        div.className = `tag-item ${isActive ? 'active-selection' : ''}`;
        div.innerHTML = `
            <div class="tag-left"><span class="tag-dot" style="background:${tag.color}"></span>${tag.name}</div>
            <button class="btn-delete" style="width: 22px; height: 22px; font-size: 11px;">x</button>
        `;
        
        div.querySelector('.tag-left').addEventListener('click', () => {
            selectedTag = isActive ? null : tag; 
            updateActiveTagUI();
            renderTags(); 
        });
        
        div.querySelector('.btn-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (selectedTag && selectedTag.id === tag.id) { selectedTag = null; updateActiveTagUI(); }
            appData.tags = appData.tags.filter(t => t.id !== tag.id);
            await saveUserData(); renderTags();
        });
        
        list.appendChild(div);
    });
}

document.getElementById('add-tag-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-tag-name');
    const colorInput = document.getElementById('new-tag-color');
    if (!nameInput.value.trim()) return;
    
    const newTag = { id: Date.now(), name: nameInput.value.trim(), color: colorInput.value };
    appData.tags.push(newTag);
    nameInput.value = '';
    
    await saveUserData();
    renderTags();
});

function updateActiveTagUI() {
    const dot = document.getElementById('active-tag-dot');
    const text = document.getElementById('active-tag-text');
    if (selectedTag) {
        dot.style.background = selectedTag.color;
        text.innerText = selectedTag.name;
    } else {
        dot.style.background = '#ccc';
        text.innerText = "Untagged";
    }
}

// --- Audio Controls ---
const rainAudio = document.getElementById('rain-audio');
const chimeAudio = document.getElementById('chime-audio');
const btnRain = document.getElementById('btn-rain');
const btnChime = document.getElementById('btn-chime');
let isRainPlaying = false;
let isChimeActive = true; 

btnRain.addEventListener('click', () => {
    if (!isRainPlaying) {
        rainAudio.play().catch(e => console.log("Make sure rain.mp3 is in the folder!"));
        btnRain.classList.add('active');
        isRainPlaying = true;
    } else {
        rainAudio.pause();
        btnRain.classList.remove('active');
        isRainPlaying = false;
    }
});

btnChime.addEventListener('click', () => {
    isChimeActive = !isChimeActive;
    if (isChimeActive) {
        btnChime.classList.add('active');
    } else {
        btnChime.classList.remove('active');
    }
});

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
            
            if (isChimeActive) {
                chimeAudio.play().catch(e => console.log("Make sure chime.mp3 is in the folder!"));
            }
            
            // Record Session with Tag Snapshot
            const now = new Date();
            appData.sessions.unshift({
                id: Date.now(),
                duration_minutes: Math.round(totalDurationSeconds / 60),
                status: 'Complete',
                timestamp: now.toISOString(),
                dateStr: now.toISOString().split('T')[0],
                timeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                monthStr: now.toLocaleString('default', { month: 'short' }),
                yearNum: now.getFullYear(),
                tagName: selectedTag ? selectedTag.name : "Untagged",
                tagColor: selectedTag ? selectedTag.color : "#ccc"
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
        document.title = "Focus Tea Room V3.5";
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
    document.title = "Focus Tea Room V3.5";
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
        
        div.querySelector('.btn-delete').addEventListener('click', async (e) => { 
            e.stopPropagation(); 
            appData.archivedTasks.unshift({ ...task, archivedAt: new Date().toISOString() });
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

const archiveModal = document.getElementById('archive-modal');
document.getElementById('open-archive-btn').addEventListener('click', () => { renderArchive(); archiveModal.style.display = 'flex'; });
document.getElementById('close-archive-btn').addEventListener('click', () => { archiveModal.style.display = 'none'; });

function renderArchive() {
    const list = document.getElementById('archive-list'); list.innerHTML = '';
    if (appData.archivedTasks.length === 0) { list.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding: 20px 0;">No packed tasks yet! Finish some work and send them here.</div>'; return; }
    appData.archivedTasks.forEach(task => {
        const dateStr = new Date(task.archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        list.innerHTML += `<div class="archive-item"><span>${task.task}</span><span class="archive-date">${dateStr}</span></div>`;
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
        const tagName = s.tagName || "Untagged";
        const tagColor = s.tagColor || "#ccc";
        logBody.innerHTML += `
            <tr>
                <td><span class="log-tag"><span class="tag-dot" style="background:${tagColor}"></span>${tagName}</span></td>
                <td>${s.duration_minutes}m</td>
                <td><span class="badge">DONE</span></td>
            </tr>`;
    });
}

function renderAll() { renderTodos(); renderStats(); renderBrewLog(); renderTags(); updateActiveTagUI(); updateTeacupFill(); }

// --- Upgraded Cute Sink Dashboard ---
document.getElementById('open-sink-btn').addEventListener('click', () => {
    const sinkTab = window.open('about:blank', '_blank'); 
    
    const monthStats = {};
    const tagStats = {};
    let totalTime = 0;
    let totalTeacups = 0;
    let maxFocusTime = 0;
    let maxMonthKey = null;
    let topTagKey = "None";
    let topTagTime = 0;

    appData.sessions.forEach(s => {
        if (s.status !== 'Complete') return;
        totalTeacups++;
        totalTime += s.duration_minutes;
        
        // Month Data
        const d = new Date(s.timestamp || s.dateStr);
        const mKey = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        if (!monthStats[mKey]) monthStats[mKey] = { cups: 0, time: 0 };
        monthStats[mKey].cups += 1;
        monthStats[mKey].time += s.duration_minutes;
        if (monthStats[mKey].time > maxFocusTime) { maxFocusTime = monthStats[mKey].time; maxMonthKey = mKey; }

        // Tag Data
        const tName = s.tagName || "Untagged";
        const tColor = s.tagColor || "#ccc";
        if (!tagStats[tName]) tagStats[tName] = { time: 0, color: tColor };
        tagStats[tName].time += s.duration_minutes;
        if (tagStats[tName].time > topTagTime && tName !== "Untagged") {
            topTagTime = tagStats[tName].time;
            topTagKey = tName;
        }
    });

    let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>My Focus Sink - Tea Room</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
            body { 
                font-family: 'Nunito', sans-serif; 
                background: linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%); 
                color: #374151; 
                margin: 0; 
                padding: 40px; 
                min-height: 100vh;
                position: relative;
                overflow-x: hidden;
            }
            .container { max-width: 1000px; margin: 0 auto; position: relative; z-index: 10; padding-bottom: 120px; }
            
            /* Wave Animation Classes */
            .ocean { height: 120px; width: 100%; position: fixed; bottom: 0; left: 0; background: transparent; z-index: 1; }
            .wave {
                background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%23ffffff" fill-opacity="0.6" d="M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,165.3C672,171,768,213,864,224C960,235,1056,213,1152,186.7C1248,160,1344,128,1392,112L1440,96L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>');
                background-size: 1000px 120px;
                position: absolute; width: 200%; height: 100%; bottom: 0;
                animation: wave 10s linear infinite;
                transform: translate3d(0, 0, 0);
            }
            .wave:nth-of-type(2) {
                bottom: -15px; animation: wave 18s linear reverse infinite; opacity: 0.8;
                background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%23ffffff" fill-opacity="0.9" d="M0,128L48,144C96,160,192,192,288,192C384,192,480,160,576,144C672,128,768,128,864,149.3C960,171,1056,213,1152,213.3C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>');
            }
            @keyframes wave { 0% { margin-left: 0; } 100% { margin-left: -1000px; } }

            /* Header */
            .header-panel { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .header-left h1 { color: #0f766e; margin: 0 0 5px 0; font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
            .header-left p { color: #0d9488; margin: 0; font-weight: 700; }
            
            /* Stat Cards Row */
            .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
            .stat-card { background: rgba(255,255,255,0.9); padding: 24px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 2px solid white; display: flex; align-items: center; gap: 15px; transition: transform 0.2s; backdrop-filter: blur(10px); }
            .stat-card:hover { transform: translateY(-3px); }
            .stat-icon { font-size: 30px; background: #e0f2fe; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 20px; }
            .stat-info h3 { margin: 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
            .stat-info p { margin: 5px 0 0 0; font-size: 22px; font-weight: 800; color: #111827; }

            /* Split Layout: Months vs Tags */
            .main-content { display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
            .section-title { font-size: 16px; font-weight: 800; color: #115e59; margin: 0 0 20px 0; border-bottom: 2px dashed #99f6e4; padding-bottom: 10px; }
            
            /* Months Grid */
            .months-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
            .month-card { background: rgba(255,255,255,0.9); border-radius: 20px; padding: 20px; border: 2px solid white; position: relative; text-align: center; box-shadow: 0 8px 25px rgba(0,0,0,0.03); backdrop-filter: blur(10px); }
            .month-card.max { border: 2px solid #06b6d4; background: white; }
            .m-sticker { font-size: 40px; margin-bottom: 10px; display: block; animation: float 3s ease-in-out infinite; }
            @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
            
            .m-title { font-weight: 800; font-size: 15px; color: #374151; }
            .m-sub { font-size: 12px; color: #6b7280; font-weight: 700; margin-top: 4px; }
            .m-bar { height: 8px; background: #e5e7eb; border-radius: 4px; margin-top: 15px; overflow: hidden; }
            .m-fill { height: 100%; background: #06b6d4; border-radius: 4px; }

            /* Tag Analytics */
            .tag-analytics { background: rgba(255,255,255,0.9); border-radius: 24px; padding: 24px; border: 2px solid white; box-shadow: 0 10px 30px rgba(0,0,0,0.05); backdrop-filter: blur(10px); }
            .tag-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; font-size: 14px; font-weight: 700; }
            .t-left { display: flex; align-items: center; gap: 10px; color: #374151; }
            .t-dot { width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .t-right { color: #6b7280; background: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; }
        </style>
    </head>
    <body>
        <div class="ocean">
            <div class="wave"></div>
            <div class="wave"></div>
        </div>
        
        <div class="container">
            <div class="header-panel">
                <div class="header-left">
                    <h1><span>🧽</span> The Sink Dashboard</h1>
                    <p>A clean overview of your focus habits.</p>
                </div>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-icon">☕</div>
                    <div class="stat-info"><h3>Total Brews</h3><p>${totalTeacups} Cups</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-info"><h3>Focus Time</h3><p>${Math.floor(totalTime/60)}h ${totalTime%60}m</p></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-info"><h3>Top Tag</h3><p>${topTagKey}</p></div>
                </div>
            </div>

            <div class="main-content">
                <div>
                    <h2 class="section-title">Monthly Focus Tracker</h2>
                    <div class="months-grid">
    `;

    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();

    // Render Month Cards with Cute Tiered Images
    monthsList.forEach(m => {
        const fullKey = `${m} ${currentYear}`;
        const stats = monthStats[fullKey] || { cups: 0, time: 0 };
        const isMax = (fullKey === maxMonthKey && stats.cups > 0);
        
        // Cute Tier System Logic
        let sticker = "🕸️💤"; // Tier 0 (Empty)
        if (isMax) sticker = "🐰🏆"; // Champion (Highest Month)
        else if (stats.cups >= 15) sticker = "🦊✨"; // Tier 1 (Very High)
        else if (stats.cups >= 8) sticker = "🐻🍯"; // Tier 2 (High/Steady)
        else if (stats.cups >= 3) sticker = "🐢🌱"; // Tier 3 (Medium)
        else if (stats.cups > 0) sticker = "🐌🍃"; // Tier 4 (Just started)
        
        const fillPercent = maxFocusTime > 0 ? (stats.time / maxFocusTime) * 100 : 0;

        html += `
            <div class="month-card ${isMax ? 'max' : ''}">
                <div class="m-sticker">${sticker}</div>
                <div class="m-title">${fullKey}</div>
                <div class="m-sub">${stats.cups} Cups • ${Math.floor(stats.time/60)}h ${stats.time%60}m</div>
                <div class="m-bar"><div class="m-fill" style="width: ${fillPercent}%;"></div></div>
            </div>
        `;
    });

    html += `
                    </div>
                </div>
                <div>
                    <h2 class="section-title">Tag Breakdown</h2>
                    <div class="tag-analytics">
    `;
    
    // Render Tags in Sink
    const sortedTags = Object.entries(tagStats).sort((a, b) => b[1].time - a[1].time);
    if (sortedTags.length === 0) {
        html += `<div style="color: #9ca3af; text-align: center; padding: 20px 0;">No tagged sessions yet.</div>`;
    } else {
        sortedTags.forEach(([tName, tData]) => {
            html += `
                <div class="tag-row">
                    <div class="t-left"><span class="t-dot" style="background: ${tData.color}"></span>${tName}</div>
                    <div class="t-right">${Math.floor(tData.time/60)}h ${tData.time%60}m</div>
                </div>
            `;
        });
    }

    html += `
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
    
    sinkTab.document.write(html);
    sinkTab.document.close();
});