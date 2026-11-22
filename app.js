// --- DATA STORAGE ---
const tasks = JSON.parse(localStorage.getItem('tasks')||'{}');
const moodHistory = JSON.parse(localStorage.getItem('moodHistory')||'{}');
const familyMessages = JSON.parse(localStorage.getItem('familyMessages')||'[]');
const gratitude = JSON.parse(localStorage.getItem('gratitude')||'{}');
const focusRecords = JSON.parse(localStorage.getItem('focusRecords')||generateRawData());

let timerInterval, secondsLeft = 25 * 60, audioCtx, noiseNode, mediaRecorder, audioChunks = [];
let moodChart, recapChart;

const quotes = ["Even lanterns need rest before they glow again.", "Slow progress is still progress.", "One step at a time.", "Rest is productive too."];

window.onload = () => {
    document.getElementById('dailyGreeting').innerText = "✨ " + quotes[Math.floor(Math.random()*quotes.length)];
    displayStreak();
    showTodayTasks();
    renderFamilyList();
    displayGratitude();
    renderCharts();
};

// --- CHARTS LOGIC ---
function renderCharts() {
    const moodMap = { 'happy': 3, 'calm': 2, 'stressed': 1, 'tired': 0 };
    const today = new Date().toISOString().slice(0,10);
    
    // Mood Chart (Last 7 Days)
    const moodLabels = [];
    const moodData = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate()-i);
        const ds = d.toISOString().slice(0,10);
        moodLabels.push(ds.split('-')[2]);
        moodData.push(moodHistory[ds] !== undefined ? moodMap[moodHistory[ds]] : null);
    }
    if(moodChart) moodChart.destroy();
    moodChart = new Chart(document.getElementById('moodChart'), {
        type: 'line', data: { labels: moodLabels, datasets: [{ label: 'Mood', data: moodData, borderColor: '#7a61e8', tension: 0.4 }] },
        options: { scales: { y: { min: 0, max: 3, ticks: { callback: (v) => ['😴','😟','🙂','😊'][v] } } } }
    });

    // 30-Day Recap Chart
    const recapLabels = Array.from({length: 30}, (_, i) => i + 1);
    const recapData = recapLabels.map(day => focusRecords[Object.keys(focusRecords)[day]] || Math.floor(Math.random()*60));
    if(recapChart) recapChart.destroy();
    recapChart = new Chart(document.getElementById('recapChart'), {
        type: 'bar', data: { labels: recapLabels, datasets: [{ label: 'Minutes', data: recapData, backgroundColor: '#ffd88a' }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- MOOD CLICK ---
document.querySelectorAll('.moodBtn').forEach(btn => {
    btn.onclick = () => {
        moodHistory[new Date().toISOString().slice(0,10)] = btn.dataset.mood;
        localStorage.setItem('moodHistory', JSON.stringify(moodHistory));
        renderCharts();
    };
});

// --- FOCUS TIMER ---
document.getElementById('startPom').onclick = () => {
    if(timerInterval) return;
    const noise = document.getElementById('ambientSelect').value;
    if(noise !== 'none') playNoise();
    timerInterval = setInterval(() => {
        secondsLeft--;
        const m = Math.floor(secondsLeft/60).toString().padStart(2,'0');
        const s = (secondsLeft%60).toString().padStart(2,'0');
        document.getElementById('timer').innerText = `${m}:${s}`;
        if(secondsLeft <= 0) {
            clearInterval(timerInterval); timerInterval = null;
            updateStreak(); alert("Session Done!");
        }
    }, 1000);
};

document.getElementById('stopPom').onclick = () => { clearInterval(timerInterval); timerInterval = null; if(audioCtx) audioCtx.close(); };

function playNoise() {
    audioCtx = new AudioContext();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0; i<data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseNode = audioCtx.createBufferSource(); noiseNode.buffer = buffer; noiseNode.loop = true;
    noiseNode.connect(audioCtx.destination); noiseNode.start();
}

// --- STREAK ---
function updateStreak() {
    let s = parseInt(localStorage.getItem('studyStreak')||'0') + 1;
    localStorage.setItem('studyStreak', s);
    displayStreak();
}
function displayStreak() { document.getElementById('streakCount').innerText = localStorage.getItem('studyStreak')||'0'; }

// --- FAMILY LETTERS ---
document.getElementById('startRec').onclick = async () => {
    const s = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(s); audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
        const reader = new FileReader();
        reader.onload = () => window.lastAudio = reader.result;
        reader.readAsDataURL(new Blob(audioChunks));
    };
    mediaRecorder.start(); document.getElementById('startRec').style.display='none'; document.getElementById('stopRec').style.display='block';
};
document.getElementById('stopRec').onclick = () => { mediaRecorder.stop(); document.getElementById('startRec').style.display='block'; document.getElementById('stopRec').style.display='none'; };

document.getElementById('saveFamily').onclick = () => {
    const text = document.getElementById('familyText').value;
    const file = document.getElementById('familyPhoto').files[0];
    const save = (img) => {
        familyMessages.push({ text, photo: img, audio: window.lastAudio, ts: new Date().toLocaleString() });
        localStorage.setItem('familyMessages', JSON.stringify(familyMessages));
        window.lastAudio = null; renderFamilyList();
    };
    if(file) { const r = new FileReader(); r.onload = () => save(r.result); r.readAsDataURL(file); } else save(null);
};

function renderFamilyList() {
    document.getElementById('familyList').innerHTML = familyMessages.slice().reverse().map((m, i) => `<li>
        <button onclick="deleteMsg(${familyMessages.length-1-i})" style="float:right; color:red; border:none; background:none; cursor:pointer;">✕</button>
        <p>${m.text}</p>
        ${m.photo ? `<img src="${m.photo}" style="max-width:100%;">` : ''}
        ${m.audio ? `<audio controls src="${m.audio}" style="width:100%;"></audio>` : ''}
    </li>`).join('');
}
function deleteMsg(i) { familyMessages.splice(i,1); localStorage.setItem('familyMessages', JSON.stringify(familyMessages)); renderFamilyList(); }

// --- TASKS & GRATITUDE ---
document.getElementById('addTaskBtn').onclick = () => {
    const t = document.getElementById('taskInput').value;
    const d = document.getElementById('dateInput').value;
    if(!tasks[d]) tasks[d] = []; tasks[d].push(t);
    if(tasks[d].length >= 6) { document.getElementById('overloadText').innerText = "Progress > Perfection. Take a break."; document.getElementById('lanternPopup').style.display='flex'; }
    localStorage.setItem('tasks', JSON.stringify(tasks)); showTodayTasks();
};
function showTodayTasks() { const d = new Date().toISOString().slice(0,10); document.getElementById('todayList').innerHTML = (tasks[d]||[]).map((t,i)=>`<li>${t} <button onclick="deleteTask('${d}',${i})">✕</button></li>`).join(''); }
function deleteTask(d,i) { tasks[d].splice(i,1); localStorage.setItem('tasks', JSON.stringify(tasks)); showTodayTasks(); }
window.closePopup = () => document.getElementById('lanternPopup').style.display='none';
document.getElementById('saveGratitude').onclick = () => { gratitude[new Date().toISOString().slice(0,10)] = document.getElementById('gratitudeInput').value; localStorage.setItem('gratitude', JSON.stringify(gratitude)); displayGratitude(); };
function displayGratitude() { document.getElementById('gratitudeDisplay').innerText = gratitude[new Date().toISOString().slice(0,10)] || ""; }
function generateRawData() { const d = {}; for(let i=0; i<30; i++) d[i] = Math.floor(Math.random()*60); return d; }