let memory = JSON.parse(localStorage.getItem("memory")) || [];
let archive = JSON.parse(localStorage.getItem("archive")) || {
  total: 0,
  count: 0
};
let profile = JSON.parse(localStorage.getItem("profile")) || {
  type: "normal",
  score: 0
};

// ---------------- METEO ----------------
async function weather(lat, lon) {
  try {
    const res = await fetch(
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,windspeed_10m,winddirection_10m,relativehumidity_2m,weathercode&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
);
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ---------------- IA ----------------
function predict(temp, hum, wind) {
  temp = temp ?? 0;
  hum = hum ?? 50;
  wind = wind ?? 5;

  let feels = temp + (hum / 100) * 4 - wind * 0.1;

  if (profile.type === "cold") feels -= 1;
  if (profile.type === "hot") feels += 1;

  return feels;
}
function getSafe(arr, index, fallback) {
  if (!arr || arr[index] === undefined || arr[index] === null) {
    return fallback;
  }
  return arr[index];
}

function weatherIconFromCode(code) {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "❓";
}
// ---------------- DIRECTION VENT ----------------

function windDirection(deg){

  if(deg === undefined) return "";

  if(deg < 22.5) return "N";
  if(deg < 67.5) return "NE";
  if(deg < 112.5) return "E";
  if(deg < 157.5) return "SE";
  if(deg < 202.5) return "S";
  if(deg < 247.5) return "SO";
  if(deg < 292.5) return "O";
  if(deg < 337.5) return "NO";

  return "N";
}
// ---------------- SAISON ----------------

function getSeason(){

  let month = new Date().getMonth();

  if(month >= 2 && month <= 4)
    return "🌱 Printemps";

  if(month >= 5 && month <= 7)
    return "☀️ Été";

  if(month >= 8 && month <= 10)
    return "🍂 Automne";

  return "❄️ Hiver";
}
// ---------------- IA LEVEL (FIX STRICT) ----------------
function comfortLevel(feels) {
  if (feels < 10) return "🥶 Froid";
  if (feels >= 10 && feels <= 22) return "🙂 OK";
  if (feels >= 22) return " 🔥 Chaud";
  return "☀️ Chaud";
}
// ---------------- CONSEIL IA ----------------
function comfortAdvice(feels, wind){

  if(feels < 5){
    return "🥶 Conseil IA : vêtements chauds recommandés";
  }

  if(feels < 12){
    return "🧥 Conseil IA : veste ou pull conseillé";
  }

  if(feels >= 12 && feels <= 22){

    if(wind > 20){
      return "🌬️ Conseil IA : température agréable mais vent présent";
    }

    return "👕 Conseil IA : tenue légère confortable";
  }

  if(feels < 28){
    return "☀️ Conseil IA : vêtements légers recommandés";
  }

  return "🥵 Conseil IA : privilégier l'ombre et l'hydratation";
}
// ---------------- CONFIANCE IA ----------------
// ---------------- CONFIANCE IA PROGRESSIVE ----------------
// ---------------- CONFIANCE IA PAR SAISON ----------------

function aiConfidence(){

  let currentSeason = getSeason();

  let globalCount = memory.length;

  let seasonCount = memory.filter(m =>
    m.season === currentSeason
  ).length;


  let globalConfidence = Math.round(
    100 * (1 - Math.exp(-globalCount / 50))
  );


  let seasonConfidence = Math.round(
    100 * (1 - Math.exp(-seasonCount / 30))
  );


  return `
🧠 IA globale : ${globalConfidence}%
${currentSeason} : ${seasonConfidence}%
`;
}
// ---------------- GPS ----------------
function gps() {
  navigator.geolocation.getCurrentPosition(
    pos => load(pos.coords.latitude, pos.coords.longitude),
    () => alert("GPS refusé")
  );
}

// ---------------- SEARCH ----------------
async function searchCity() {
  let city = document.getElementById("search").value;
  if (!city) return;

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`
  );

  const data = await res.json();

  if (data?.results?.length) {
    let r = data.results[0];
    load(r.latitude, r.longitude);
  } else {
    alert("Ville introuvable");
  }
}

// ---------------- SUGGESTIONS ----------------
async function suggestCities() {
  let input = document.getElementById("search").value;
  let box = document.getElementById("suggestions");

  if (!input || input.length < 2) {
    box.innerHTML = "";
    return;
  }

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=5&language=fr`
  );

  const data = await res.json();

  box.innerHTML = "";

  if (!data?.results) return;

  data.results.forEach(city => {
    let div = document.createElement("div");
    div.className = "suggestion";
    div.innerText = city.name;

    div.onclick = () => {
      document.getElementById("search").value = city.name;
      box.innerHTML = "";
      load(city.latitude, city.longitude);
    };

    box.appendChild(div);
  });
}
 
// ---------------- LOAD ----------------
async function load(lat, lon) {
  let data = await weather(lat, lon);
  if (!data) return;

  let current = data.current_weather || {};
  let hourly = data.hourly || {};
  let daily = data.daily || {};

  let temp = current.temperature ?? 0;
  let wind = current.windspeed ?? 5;
  let windDeg = current.winddirection ?? 
              hourly.winddirection_10m?.[0] ?? 0;

let windDir = windDirection(windDeg);
  let hum = hourly.relativehumidity_2m?.[0] ?? 50;

  let feel = predict(temp, hum, wind);
  document.getElementById("advice").innerText =
comfortAdvice(feel, wind);

  // ---------------- MATIN / MIDI / SOIR ----------------
  let iMatin = 8;
let iMidi = 13;
let iSoir = 20;

let tMatin = getSafe(hourly.temperature_2m, iMatin, temp);
let tMidi = getSafe(hourly.temperature_2m, iMidi, temp);
let tSoir = getSafe(hourly.temperature_2m, iSoir, temp);

let hMatin = getSafe(hourly.relativehumidity_2m, iMatin, hum);
let hMidi = getSafe(hourly.relativehumidity_2m, iMidi, hum);
let hSoir = getSafe(hourly.relativehumidity_2m, iSoir, hum);

let wMatin = getSafe(hourly.windspeed_10m, iMatin, wind);
let wMidi = getSafe(hourly.windspeed_10m, iMidi, wind);
let wSoir = getSafe(hourly.windspeed_10m, iSoir, wind);

let cMatin = getSafe(hourly.weathercode, iMatin, 0);
let cMidi = getSafe(hourly.weathercode, iMidi, 0);
let cSoir = getSafe(hourly.weathercode, iSoir, 0);

let matin = predict(tMatin, hMatin, wMatin);
let midi = predict(tMidi, hMidi, wMidi);
let soir = predict(tSoir, hSoir, wSoir);

  document.getElementById("temp").innerText = temp;
  document.getElementById("feel").innerText = feel.toFixed(1);
  document.getElementById("hum").innerText = hum;
document.getElementById("wind").innerText =
  `${wind} km/h ${windDir}`;

 document.getElementById("forecast").innerHTML =
  `<div style="display:flex; justify-content:space-between; text-align:center;">
     <span style="flex:1;">Matin ${matin.toFixed(1)}°C</span>
     <span style="flex:1;">Midi ${midi.toFixed(1)}°C</span>
     <span style="flex:1;">Soir ${soir.toFixed(1)}°C</span>
   </div>
   <div style="display:flex; justify-content:space-between; text-align:center; font-size:22px;">
     <span style="flex:1;">${weatherIconFromCode(cMatin)}</span>
     <span style="flex:1;">${weatherIconFromCode(cMidi)}</span>
     <span style="flex:1;">${weatherIconFromCode(cSoir)}</span>
   </div>`;
  // ---------------- IA FIXE ----------------
  document.getElementById("comfort").innerText =
    comfortLevel(feel);

  // ---------------- TITRE ----------------
  let title = "📊 Prévisions aujourd’hui";

  if (profile.type === "cold") title = "📊 Frileux ❄️";
  if (profile.type === "hot") title = "📊 Chaud 🔥";

  document.getElementById("forecastTitle").innerText = title;

  // ---------------- DEMAIN (FIX MIN/MAX BUG) ----------------
  // ---------------- DEMAIN IA RESSENTI ----------------

let demainMatin = predict(
  hourly.temperature_2m?.[24] ?? temp,
  hourly.relativehumidity_2m?.[24] ?? hum,
  hourly.windspeed_10m?.[24] ?? wind
);

let demainMidi = predict(
  hourly.temperature_2m?.[30] ?? temp,
  hourly.relativehumidity_2m?.[30] ?? hum,
  hourly.windspeed_10m?.[30] ?? wind
);

let demainSoir = predict(
  hourly.temperature_2m?.[38] ?? temp,
  hourly.relativehumidity_2m?.[38] ?? hum,
  hourly.windspeed_10m?.[38] ?? wind
);

// --- CODES METEO DEMAIN ---
let cMatinDemain = hourly.weathercode?.[24] ?? 0;
let cMidiDemain = hourly.weathercode?.[30] ?? 0;
let cSoirDemain = hourly.weathercode?.[38] ?? 0;

// --- AFFICHAGE ---
document.getElementById("tomorrow").innerHTML =
  `<div style="display:flex; justify-content:space-between; text-align:center;">
     <span style="flex:1;">Matin ${demainMatin.toFixed(1)}°C</span>
     <span style="flex:1;">Midi ${demainMidi.toFixed(1)}°C</span>
     <span style="flex:1;">Soir ${demainSoir.toFixed(1)}°C</span>
   </div>
   <div style="display:flex; justify-content:space-between; text-align:center; font-size:22px;">
     <span style="flex:1;">${weatherIconFromCode(cMatinDemain)}</span>
     <span style="flex:1;">${weatherIconFromCode(cMidiDemain)}</span>
     <span style="flex:1;">${weatherIconFromCode(cSoirDemain)}</span>
   </div>`;
// ---------------- ALERTES METEO ----------------

let alertMessage = "🟢 Normal";


// Niveau 1 : risque incendie végétation
if (temp > 30 && hum < 30 && wind > 30) {

  alertMessage =
    "🔴 Conditions très favorables au risque incendie végétation";

}


// Niveau 2 : vigilance chaleur et sécheresse
else if (
  (temp > 28 && hum < 40) ||
  (temp > 30 && wind > 25)
) {

  alertMessage =
    "🟠 Vigilance : conditions chaudes et sèches";

}


// Niveau 3 : forte chaleur
else if (temp > 32) {

  alertMessage =
    "🔥 Forte chaleur";

}


// Niveau 4 : vent fort
else if (wind > 50) {

  alertMessage =
    "🌬️ Vent fort";

}


document.getElementById("alert").innerText =
  alertMessage;
// ---------------- FEEDBACK ----------------
// ---------------- FEEDBACK IA ----------------
function feedback(type) {

let today = new Date().toDateString();

let alreadyToday = memory.filter(m =>
  new Date(m.date).toDateString() === today
);

if (alreadyToday.length >= 3) {
  document.getElementById("ai").innerText =
    "IA déjà alimentée aujourd'hui ✔";
  return;
}
  let t = parseFloat(document.getElementById("temp").innerText);

  if (isNaN(t)) return;

  let correction = 0;

  if (type === "hot") correction = 2;
  if (type === "cold") correction = -2;
  if (type === "ok") correction = 0;

  memory.push({
    temp: t,
    feel: t + correction,
    correction: correction,
    hour: new Date().getHours(),
    date: Date.now(),
  season: getSeason()
  });

  localStorage.setItem(
    "memory",
    JSON.stringify(memory)
  );

document.getElementById("ai").innerText =
  JSON.stringify(memory[memory.length - 1]);
  updateProfile();

  document.getElementById("ai").innerText =
    `IA apprentissage ✔ (${memory.length})`;

document.getElementById("confidence").innerText =
    aiConfidence();
}

// ------// ---------------- PROFIL AUTOMATIQUE IA ----------------
// ---------------- PROFIL AUTOMATIQUE IA ----------------
function updateProfile(){

  if(memory.length === 0) {
    profile.type = "normal";
    return;
  }

let total = 0;
let weightTotal = 0;

let now = Date.now();

// 🔹 MÉMOIRE RÉCENTE (pondérée)
memory.forEach(m => {

  let ageDays = (now - m.date) / (1000 * 60 * 60 * 24);
  let weight = Math.exp(-ageDays / 60);

  total += (m.correction || 0) * weight;
  weightTotal += weight;

});

// 🔹 ARCHIVE (poids faible mais stable)
if (archive && archive.count > 0) {

  let archiveAverage = archive.total / archive.count;

  // poids global faible pour ne pas écraser le récent
  let archiveWeight = 0.2;

  total += archiveAverage * archiveWeight;
  weightTotal += archiveWeight;
}

let average = weightTotal > 0 
  ? total / weightTotal 
  : 0;

  profile.score = average;

  if(average < -0.8){
    profile.type = "cold";
  }
  else if(average > 0.8){
    profile.type = "hot";
  }
  else{
    profile.type = "normal";
  }

  localStorage.setItem(
    "profile",
    JSON.stringify(profile)
  );
}
// ---------------- NETTOYAGE MEMOIRE ----------------
function cleanMemory(){

  let now = Date.now();

  // 90 jours
  let limit = 1000 * 60 * 60 * 24 * 90;

 let newMemory = [];

memory.forEach(m => {

  if ((now - m.date) < limit) {
    newMemory.push(m);
  } else {
    // 👉 on archive au lieu de supprimer
    archive.total += m.correction || 0;
    archive.count += 1;
  }

});

memory = newMemory;

  localStorage.setItem(
  "archive",
  JSON.stringify(archive)
);
}
// ---------------- RESET IA ----------------
function resetAI(){

  if(confirm("Effacer l'apprentissage IA ?")){

    memory = [];

    profile = {
      type: "normal",
      score: 0
    };

    localStorage.removeItem("memory");

    localStorage.setItem(
      "profile",
      JSON.stringify(profile)
    );

    document.getElementById("ai").innerText =
      "IA réinitialisée ✔";

    document.getElementById("confidence").innerText =
      "🧠 Confiance IA : apprentissage en cours";

    document.getElementById("advice").innerText =
      "";

  }
}
