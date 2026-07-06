let memory = JSON.parse(localStorage.getItem("memory")) || [];

// ---------------- CACHE ----------------
const CACHE_TIME = 10 * 60 * 1000; 

function getCacheKey(lat, lon){
  return `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

function saveCache(lat, lon, data){
  localStorage.setItem(getCacheKey(lat, lon), JSON.stringify({
    time: Date.now(),
    data: data
  }));
}

function loadCache(lat, lon){
  let cache = localStorage.getItem(getCacheKey(lat, lon));
  if(!cache) return null;
  cache = JSON.parse(cache);
  if(Date.now() - cache.time > CACHE_TIME){
    return null;
  }
  return cache.data;
}

// ---------------- API ----------------
async function weather(lat, lon){
  let cached = loadCache(lat, lon);
  if(cached) return cached;

  const res = await fetch(
    `https://open-meteo.com{lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,windspeed_10m,weathercode`
  );
  let data = await res.json();
  saveCache(lat, lon, data);
  return data;
}

// ---------------- IA ----------------
function predict(temp, hum, wind){
  if(memory.length === 0) return temp;
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
  }, err => {
    alert("Géolocalisation refusée ou indisponible.");
  });
}

// ---------------- VILLE ----------------
async function searchCity(){
  let city = document.getElementById("search").value;
  if(!city) return;

  try {
    const res = await fetch(
      `https://open-meteo.com{encodeURIComponent(city)}&count=1`
    );
    const data = await res.json();

    // Correction cruciale ici : ajout de [0] pour cibler le premier résultat
    if(data.results && data.results.length > 0){
      load(data.results[0].latitude, data.results[0].longitude);
      document.getElementById("suggestions").innerHTML = ""; // Ferme les suggestions
    } else {
      alert("Ville non trouvée");
    }
  } catch (error) {
    console.error("Erreur lors de la recherche :", error);
  }
}

// ---------------- LOAD ----------------
async function load(lat, lon){
  try {
    let data = await weather(lat, lon);
    if(!data || !data.current_weather) return;

    let t = data.current_weather.temperature;
    let w = data.current_weather.windspeed;
    
    // Sécurisation de l'humidité si non définie
    let h = (data.hourly && data.hourly.relative_humidity_2m && data.hourly.relative_humidity_2m[0]) 
            ? data.hourly.relative_humidity_2m[0] 
            : 50;

    let feel = predict(t, h, w);

    document.getElementById("temp").innerText = t;
    document.getElementById("feel").innerText = feel.toFixed(1);
    document.getElementById("hum").innerText = h;
    document.getElementById("wind").innerText = w;

    forecast(data);
    tomorrow(data);
    alerts(t, h);
  } catch(e) {
    console.error("Erreur de chargement:", e);
  }
}

// ---------------- PREVISIONS ----------------
function forecast(data){
  if(!data.hourly) return;
  let t = data.hourly.temperature_2m;
  let h = data.hourly.relative_humidity_2m;
  let w = data.hourly.windspeed_10m;
  let code = data.hourly.weathercode;

  // Sécurisation des index horaires de l'API
  let m = predict(t[8] || t[0], h[8] || h[0], w[8] || w[0]);
  let n = predict(t[12] || t[0], h[12] || h[0], w[12] || w[0]);
  let e = predict(t[18] || t[0], h[18] || h[0], w[18] || w[0]);

  let iconM = getIcon(code[8] || 0, w[8] || 0);
  let iconN = getIcon(code[12] || 0, w[12] || 0);
  let iconE = getIcon(code[18] || 0, w[18] || 0);

  document.getElementById("forecast").innerHTML =
    `${iconM} Matin: ${m.toFixed(1)}°C<br> ${iconN} Midi: ${n.toFixed(1)}°C<br> ${iconE} Soir: ${e.toFixed(1)}°C`;
}

// ---------------- DEMAIN ----------------
function tomorrow(data){
  if(!data.hourly || !data.hourly.temperature_2m[24]) return;
  let t = data.hourly.temperature_2m[24];
  let h = data.hourly.relative_humidity_2m[24] || 50;
  let w = data.hourly.windspeed_10m[24] || 10;

  let f = predict(t, h, w);
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
  if(isNaN(t)) return; // Empêche de voter si aucune météo n'est chargée

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

  if(!input || input.length < 2){
    box.innerHTML = "";
    return;
  }

  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    try {
      const res = await fetch(
        `https://open-meteo.com{encodeURIComponent(input)}&count=5`
      );
      const data = await res.json();

      box.innerHTML = "";

      if(!data.results || data.results.length === 0) return;

      data.results.forEach(city => {
        let div = document.createElement("div");
        div.className = "suggestion";
        div.style.padding = "8px";
        div.style.cursor = "pointer";
        div.innerText = `${city.name} (${city.country || ""})`;
        
        div.addEventListener("click", () => {
          document.getElementById("search").value = city.name;
          box.innerHTML = "";
          load(city.latitude, city.longitude);
        });

        box.appendChild(div);
      });
    } catch (err) {
      console.error(err);
    }
  }, 250);
}
