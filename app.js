let memory = JSON.parse(localStorage.getItem("memory")) || [];

// ---------------- CACHE REQUÊTES ----------------
const CACHE_TIME = 10 * 60 * 1000; 

function getCacheKey(lat, lon, type){
  return `weather_${lat.toFixed(2)}_${lon.toFixed(2)}_${type}`;
}

function saveCache(lat, lon, type, data){
  localStorage.setItem(getCacheKey(lat, lon, type), JSON.stringify({
    time: Date.now(),
    data: data
  }));
}

function loadCache(lat, lon, type){
  let cache = localStorage.getItem(getCacheKey(lat, lon, type));
  if(!cache) return null;
  cache = JSON.parse(cache);
  if(Date.now() - cache.time > CACHE_TIME){
    return null;
  }
  return cache.data;
}

// ---------------- APPEL API METEO ----------------
async function fetchCurrentWeather(lat, lon) {
  let cached = loadCache(lat, lon, "current");
  if(cached) return cached;
  try {
    const res = await fetch(`https://open-meteo.com{lat}&longitude=${lon}&current_weather=true`);
    let data = await res.json();
    saveCache(lat, lon, "current", data);
    return data;
  } catch (e) {
    return null;
  }
}

async function fetchHourlyWeather(lat, lon) {
  let cached = loadCache(lat, lon, "hourly");
  if(cached) return cached;
  try {
    const res = await fetch(`https://open-meteo.com{lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,windspeed_10m,weathercode&forecast_days=2`);
    let data = await res.json();
    saveCache(lat, lon, "hourly", data);
    return data;
  } catch (e) {
    return null;
  }
}

// ---------------- ALGORITHME IA ----------------
function predict(temp, hum, wind){
  if(!memory || memory.length === 0) return temp;
  let total = 0;
  let weightSum = 0;
  memory.forEach(m => {
    let diff = Math.abs(m.temp - temp) + Math.abs(m.hum - hum) + Math.abs(m.wind - wind);
    let weight = Math.max(0, 30 - diff);
    if(weight > 0){
      total += m.feel * weight;
      weightSum += weight;
    }
  });
  if(weightSum === 0) return temp;
  return total / weightSum;
}

// ---------------- ICONES ----------------
function getIcon(code, wind){
  if(wind > 35) return "💨";
  if(code === 0) return "☀️";
  if(code <= 3) return "⛅";
  if(code <= 48) return "☁️";
  if(code <= 67) return "🌧️";
  return "☁️";
}

// ---------------- GPS ----------------
function gps(){
  navigator.geolocation.getCurrentPosition(pos => {
    load(pos.coords.latitude, pos.coords.longitude);
  }, () => {
    alert("GPS indisponible ou refusé.");
  });
}

// ---------------- RECHERCHE VILLE ----------------
async function searchCity(){
  let city = document.getElementById("search").value;
  if(!city) return;
  try {
    const res = await fetch(`https://open-meteo.com{encodeURIComponent(city)}&count=1`);
    const data = await res.json();
    if(data.results && data.results.length > 0){
      let premier = data.results[0]; // Correction de l'index du tableau [1]
      load(premier.latitude, premier.longitude);
      document.getElementById("suggestions").innerHTML = ""; 
    } else {
      alert("Ville non trouvée");
    }
  } catch (error) {
    alert("Erreur de connexion au service de recherche.");
  }
}

// ---------------- LOAD CENTRAL ----------------
async function load(lat, lon){
  let currentData = await fetchCurrentWeather(lat, lon);
  if(!currentData || !currentData.current_weather) {
    alert("Données météo actuelles introuvables.");
    return;
  }

  let t = currentData.current_weather.temperature;
  let w = currentData.current_weather.windspeed;
  let h = 50; 

  let feel = predict(t, h, w);

  document.getElementById("temp").innerText = t;
  document.getElementById("feel").innerText = feel.toFixed(1);
  document.getElementById("hum").innerText = h;
  document.getElementById("wind").innerText = w;

  let hourlyData = await fetchHourlyWeather(lat, lon);
  if (hourlyData && hourlyData.hourly) {
    forecast(hourlyData);
    tomorrow(hourlyData);
  }
  alerts(t, h);
}

// ---------------- PREVISIONS (MATIN, MIDI, SOIR) ----------------
function forecast(data){
  let tempTab = data.hourly.temperature_2m || [];
  let humTab = data.hourly.relative_humidity_2m || [];
  let windTab = data.hourly.windspeed_10m || [];
  let codeTab = data.hourly.weathercode || [];

  // Sécurisation stricte des index (8h, 12h, 18h) avec repli si vide
  let tMatin = tempTab.length > 8 ? tempTab[8] : 15;
  let tMidi = tempTab.length > 12 ? tempTab[12] : 20;
  let tSoir = tempTab.length > 18 ? tempTab[18] : 17;

  let hMatin = humTab.length > 8 ? humTab[8] : 60;
  let hMidi = humTab.length > 12 ? humTab[12] : 50;
  let hSoir = humTab.length > 18 ? humTab[18] : 55;

  let wMatin = windTab.length > 8 ? windTab[8] : 10;
  let wMidi = windTab.length > 12 ? windTab[12] : 15;
  let wSoir = windTab.length > 18 ? windTab[18] : 12;

  let feelMatin = predict(tMatin, hMatin, wMatin);
  let feelMidi = predict(tMidi, hMidi, wMidi);
  let feelSoir = predict(tSoir, hSoir, wSoir);

  let iconMatin = getIcon(codeTab.length > 8 ? codeTab[8] : 0, wMatin);
  let iconMidi = getIcon(codeTab.length > 12 ? codeTab[12] : 0, wMidi);
  let iconSoir = getIcon(codeTab.length > 18 ? codeTab[18] : 0, wSoir);

  document.getElementById("forecast").innerHTML =
    `${iconMatin} Matin : ${tMatin}°C (Ressenti : ${feelMatin.toFixed(1)}°C)<br>` +
    `${iconMidi} Midi : ${tMidi}°C (Ressenti : ${feelMidi.toFixed(1)}°C)<br>` +
    `${iconSoir} Soir : ${tSoir}°C (Ressenti : ${feelSoir.toFixed(1)}°C)`;
}

// ---------------- DEMAIN ----------------
function tomorrow(data){
  let tempTab = data.hourly.temperature_2m || [];
  let humTab = data.hourly.relative_humidity_2m || [];
  let windTab = data.hourly.windspeed_10m || [];

  let tDemain = tempTab.length > 32 ? tempTab[32] : 15;
  let hDemain = humTab.length > 32 ? humTab[32] : 50;
  let wDemain = windTab.length > 32 ? windTab[32] : 10;

  let f = predict(tDemain, hDemain, wDemain);
  document.getElementById("tomorrow").innerText = `Ressenti IA : ${f.toFixed(1)}°C`;
}

// ---------------- ALERTES ----------------
function alerts(t, h){
  let msg = "OK";
  if(t > 32) msg = "🔥 Forte chaleur";
  if(h > 85) msg = "💧 Humidité élevée";
  document.getElementById("alert").innerText = msg;
}

// ---------------- FEEDBACK ----------------
function feedback(type){
  let t = parseFloat(document.getElementById("temp").innerText);
  let h = parseFloat(document.getElementById("hum").innerText);
  let w = parseFloat(document.getElementById("wind").innerText);
  if(isNaN(t)) return;
  let feel = t;
  if(type === "hot") feel += 2;
  if(type === "cold") feel -= 2;
  memory.push({ temp: t, hum: h, wind: w, feel: feel });
  localStorage.setItem("memory", JSON.stringify(memory));
  document.getElementById("ai").innerText = `IA a appris ✔ (${memory.length} données)`;
}

// ---------------- SUGGESTIONS ----------------
let timeout;
async function suggestCities(){
  let input = document.getElementById("search").value;
  let box = document.getElementById("suggestions");
  if(!box) return;
  if(!input || input.length < 2){
    box.innerHTML = "";
    return;
  }
  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    try {
      const res = await fetch(`https://open-meteo.com{encodeURIComponent(input)}&count=5`);
      const data = await res.json();
      box.innerHTML = "";
      if(!data.results || data.results.length === 0) return;
      data.results.forEach(city => {
        let div = document.createElement("div");
        div.className = "suggestion";
        div.style.padding = "6px";
        div.style.cursor = "pointer";
        div.innerText = `${city.name} (${city.country || ""})`;
        div.addEventListener("click", () => {
          document.getElementById("search").value = city.name;
          box.innerHTML = "";
          load(city.latitude, city.longitude);
        });
        box.appendChild(div);
      });
    } catch (err) {}
  }, 250);
}
