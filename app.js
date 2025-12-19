(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Tabs
  $$(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      $$(".tab").forEach(b=>b.classList.remove("active"));
      $$(".panel").forEach(p=>p.classList.remove("active"));
      btn.classList.add("active");
      $("#tab-"+btn.dataset.tab).classList.add("active");
    });
  });

  // Schedule display
  const schedule = [
    {dow:"Mon", plan:"Day A"},
    {dow:"Tue", plan:"Off"},
    {dow:"Wed", plan:"Day B"},
    {dow:"Thu", plan:"Off"},
    {dow:"Fri", plan:"Day A"},
    {dow:"Sat", plan:"Optional Day B"},
    {dow:"Sun", plan:"Photos + Check-In"},
  ];
  const scheduleGrid = $("#scheduleGrid");
  scheduleGrid.innerHTML = schedule.map(d=>`
    <div class="day">
      <div class="dow">${d.dow}</div>
      <div class="plan">${d.plan}</div>
    </div>
  `).join("");

  // Today logic (based on weekday)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2,"0");
  const dd = String(now.getDate()).padStart(2,"0");
  const iso = `${yyyy}-${mm}-${dd}`;
  $("#todayDate").textContent = now.toLocaleDateString(undefined, {weekday:"long", year:"numeric", month:"short", day:"numeric"});
  $("#logDate").value = iso;

  // Determine today's plan by weekday (Mon=1..Sun=0)
  const day = now.getDay(); // Sun=0
  let todayPlan = "Off";
  if(day === 1) todayPlan = "Day A";
  else if(day === 2) todayPlan = "Off";
  else if(day === 3) todayPlan = "Day B";
  else if(day === 4) todayPlan = "Off";
  else if(day === 5) todayPlan = "Day A";
  else if(day === 6) todayPlan = "Optional Day B";
  else if(day === 0) todayPlan = "Photos + Check-In";

  $("#todayWorkout").textContent = todayPlan;
  // Default workout in form (if optional B, set Day B)
  if(todayPlan.startsWith("Day A")) $("#logWorkout").value = "Day A";
  else if(todayPlan.includes("Day B")) $("#logWorkout").value = "Day B";
  else if(todayPlan.includes("Off") || todayPlan.includes("Photos")) $("#logWorkout").value = "Off";

  // Timer
  let timerInterval = null;
  let remaining = 10*60;
  const renderTimer = () => {
    const m = Math.floor(remaining/60);
    const s = remaining%60;
    $("#timer").textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  renderTimer();
  $("#startTimer").addEventListener("click", ()=>{
    if(timerInterval) return;
    timerInterval = setInterval(()=>{
      remaining -= 1;
      if(remaining <= 0){
        remaining = 0;
        clearInterval(timerInterval);
        timerInterval = null;
        // small vibration where supported
        if(navigator.vibrate) navigator.vibrate([200,100,200]);
      }
      renderTimer();
    }, 1000);
  });
  $("#resetTimer").addEventListener("click", ()=>{
    if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
    remaining = 10*60;
    renderTimer();
  });

  // Storage keys
  const KEY_LOGS = "workoutLogs_v1";
  const KEY_PHOTOS = "photosMarkedWeeks_v1";

  const loadLogs = () => {
    try { return JSON.parse(localStorage.getItem(KEY_LOGS) || "[]"); }
    catch { return []; }
  };
  const saveLogs = (logs) => localStorage.setItem(KEY_LOGS, JSON.stringify(logs));

  // Render table
  const renderTable = () => {
    const logs = loadLogs().sort((a,b)=> (a.date<b.date?1:-1));
    const tbody = $("#logTable tbody");
    tbody.innerHTML = logs.map(l=>`
      <tr>
        <td>${l.date}</td>
        <td>${l.workout}</td>
        <td>${l.started ? "✅" : ""}</td>
        <td>${l.finished ? "✅" : ""}</td>
        <td>${escapeHtml(l.weights||"")}</td>
        <td>${escapeHtml(l.notes||"")}</td>
      </tr>
    `).join("");
  };

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[s]));
  }

  // Form submit
  $("#logForm").addEventListener("submit", (e)=>{
    e.preventDefault();
    const entry = {
      date: $("#logDate").value,
      workout: $("#logWorkout").value,
      weights: $("#logWeights").value.trim(),
      notes: $("#logNotes").value.trim(),
      started: $("#logStarted").checked,
      finished: $("#logFinished").checked,
      ts: Date.now()
    };
    const logs = loadLogs();
    // if same date exists, replace latest
    const idx = logs.findIndex(x=>x.date===entry.date);
    if(idx >= 0) logs[idx] = entry;
    else logs.push(entry);
    saveLogs(logs);
    renderTable();
    // mark "I logged it" checkbox
    const ck = $("#ckLog"); if(ck) ck.checked = true;
    alert("Saved.");
  });

  $("#clearToday").addEventListener("click", ()=>{
    $("#logWeights").value = "";
    $("#logNotes").value = "";
    $("#logStarted").checked = false;
    $("#logFinished").checked = false;
  });

  $("#deleteLast").addEventListener("click", ()=>{
    const logs = loadLogs().sort((a,b)=>a.ts-b.ts);
    logs.pop();
    saveLogs(logs);
    renderTable();
  });

  $("#deleteAll").addEventListener("click", ()=>{
    if(confirm("Delete all logs from this device?")){
      saveLogs([]);
      renderTable();
    }
  });

  // Photos weekly marker
  function isoWeek(date){
    // ISO week number
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
  }
  const currentWeek = isoWeek(new Date());
  function loadPhotoWeeks(){
    try { return JSON.parse(localStorage.getItem(KEY_PHOTOS) || "[]"); }
    catch { return []; }
  }
  function savePhotoWeeks(arr){
    localStorage.setItem(KEY_PHOTOS, JSON.stringify(arr));
  }
  function renderPhotoStatus(){
    const weeks = loadPhotoWeeks();
    const done = weeks.includes(currentWeek);
    $("#photosStatus").textContent = done ? `Marked for ${currentWeek}` : "Not marked yet";
    // sync checklist
    const ck = $("#ckPhotos"); if(ck) ck.checked = done;
  }
  $("#markPhotos").addEventListener("click", ()=>{
    const weeks = loadPhotoWeeks();
    if(!weeks.includes(currentWeek)) weeks.push(currentWeek);
    savePhotoWeeks(weeks);
    renderPhotoStatus();
    alert("Photos marked for this week.");
  });
  renderPhotoStatus();

  // TODAY checklist persist (lightweight)
  const KEY_CK = "todayChecklist_v1";
  function loadCk(){
    try { return JSON.parse(localStorage.getItem(KEY_CK) || "{}"); }
    catch { return {}; }
  }
  function saveCk(obj){ localStorage.setItem(KEY_CK, JSON.stringify(obj)); }
  const ckObj = loadCk();
  const ckKeys = ["ckStart","ckFinish","ckLog"];
  ckKeys.forEach(id=>{
    const el = $("#"+id);
    if(!el) return;
    el.checked = !!ckObj[iso]?.[id];
    el.addEventListener("change", ()=>{
      const obj = loadCk();
      obj[iso] = obj[iso] || {};
      obj[iso][id] = el.checked;
      saveCk(obj);
    });
  });

  // Export JSON / CSV + Import JSON
  function download(filename, text){
    const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }

  $("#exportJson").addEventListener("click", ()=>{
    const payload = {
      logs: loadLogs(),
      photoWeeks: loadPhotoWeeks(),
      exportedAt: new Date().toISOString()
    };
    download(`workout-backup-${iso}.json`, JSON.stringify(payload, null, 2));
  });

  $("#exportCsv").addEventListener("click", ()=>{
    const logs = loadLogs().sort((a,b)=> (a.date>b.date?1:-1));
    const header = ["date","workout","started","finished","weights","notes"];
    const rows = logs.map(l=>[
      l.date, l.workout, l.started?"1":"0", l.finished?"1":"0",
      (l.weights||"").replaceAll('"','""'),
      (l.notes||"").replaceAll('"','""')
    ]);
    const csv = [header.join(","), ...rows.map(r=>r.map(v=>{
      if(String(v).includes(",") || String(v).includes('"') || String(v).includes("\n")) return `"${v}"`;
      return v;
    }).join(","))].join("\n");
    download(`workout-history-${iso}.csv`, csv);
  });

  // Import
  const importInput = $("#importJsonFile");
  $("#importBtn").addEventListener("click", ()=> importInput.click());
  importInput.addEventListener("change", async ()=>{
    const file = importInput.files[0];
    if(!file) return;
    const text = await file.text();
    try{
      const data = JSON.parse(text);
      if(data.logs) saveLogs(data.logs);
      if(data.photoWeeks) savePhotoWeeks(data.photoWeeks);
      renderTable();
      renderPhotoStatus();
      alert("Import complete.");
    }catch(err){
      alert("Could not import that file.");
    }finally{
      importInput.value = "";
    }
  });

  // Initial render
  renderTable();
})();
