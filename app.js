
let memory = JSON.parse(localStorage.getItem("memory")) || [];

// ---------------- METEO ----------------
async function weather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,windspeed_10m,relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min&current_weather=true&timezone=auto`
    );
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ---------------- IA PREDICTION ----------------
function predict(temp, hum, wind, hour = new Date().getHours()) {
  if (!memory || memory.length === 0) return temp;

  let total = 0;
  let weightSum = 0;

  memory.forEach(m => {
    let diff =
      Math.abs(m.temp - temp) +
      Math.abs(m.hum - hum) +
      Math.abs(m.wind - wind) +
      Math.abs(m.hour - hour) * 0.5;

    let weight = Math.max(0, 30 - diff);

    if (weight > 0) {
      total += m.feel * weight;
      weightSum += weight;
    }
  });

  if (weightSum === 0) return temp;
  return total / weightSum;
}

// ---------------- GPS ----------------
function gps() {
  navigator.geolocation.getCurrentPosition(pos => {
    load(pos.coords.latitude, pos.coords.longitude);
  }, () => {
    alert("GPS indisponible ou refusé.");
  });
}

// ---------------- SEARCH CITY ----------------
async function searchCity() {
  let city = document.getElementById("search").value;
  if (!city) return;

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );

    const data = await res.json();

    if (data && data.results && data.results.length > 0) {
      let result = data.results[0];
      load(result.latitude, result.longitude);
    } else {
      alert("Ville non trouvée");
    }
  } catch (error) {
    alert("Erreur de connexion au service de recherche.");
  }
}

// ---------------- SUGGESTIONS ----------------
async function suggestCities() {
  let input = document.getElementById("search").value;
  let box = document.getElementById("suggestions");

  if (!box) return;

  if (!input || input.length < 2) {
    box.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=5`
    );

    const data = await res.json();
    box.innerHTML = "";

    if (data && data.results) {
      data.results.forEach(city => {
        let div = document.createElement("div");
        div.className = "suggestion";
        div.innerText = city.name;

        div.addEventListener("click", () => {
          document.getElementById("search").value = city.name;
          box.innerHTML = "";
          load(city.latitude, city.longitude);
        });

        box.appendChild(div);
      });
    }
  } catch (err) {}
}

// fermer dropdown
document.addEventListener("click", (e) => {
  const box = document.getElementById("suggestions");
  const input = document.getElementById("search");

  if (!box.contains(e.target) && e.target !== input) {
    box.innerHTML = "";
  }
});

// ---------------- LOAD CENTRAL ----------------
async function load(lat, lon) {
  let data = await weather(lat, lon);

  if (!data || !data.current_weather) {
    alert("Données météo introuvables.");
    return;
  }

  let hourly = data.hourly;
  let daily = data.daily;

  // ---------- IA HOURS ----------
  function getIndex(hour) {
    let now = new Date();
    let target = new Date();
    target.setHours(hour, 0, 0, 0);

    let diff = Math.floor((target - now) / 3600000);
    return Math.max(0, diff);
  }

  let iMatin = getIndex(8);
  let iMidi = getIndex(13);
  let iSoir = getIndex(20);

  // ---------- RESSENTI IA ----------
  let matinFeel = predict(
    hourly.temperature_2m[iMatin],
    hourly.relativehumidity_2m[iMatin],
    hourly.windspeed_10m[iMatin],
    8
  );

  let midiFeel = predict(
    hourly.temperature_2m[iMidi],
    hourly.relativehumidity_2m[iMidi],
    hourly.windspeed_10m[iMidi],
    13
  );

  let soirFeel = predict(
    hourly.temperature_2m[iSoir],
    hourly.relativehumidity_2m[iSoir],
    hourly.windspeed_10m[iSoir],
    20
  );

  // ---------- AFFICHAGE ----------
  document.getElementById("temp").innerText = data.current_weather.temperature;
  document.getElementById("feel").innerText = matinFeel.toFixed(1); // valeur principale
  document.getElementById("hum").innerText = hourly.relativehumidity_2m[0];
  document.getElementById("wind").innerText = data.current_weather.windspeed;

  document.getElementById("forecast").innerHTML =
    `🌅 Matin: ${matinFeel.toFixed(1)}°C | ☀️ Midi: ${midiFeel.toFixed(1)}°C | 🌙 Soir: ${soirFeel.toFixed(1)}°C`;

  // ---------- DEMAIN ----------
  let tmin = daily.temperature_2m_min[1];
  let tmax = daily.temperature_2m_max[1];
  let avg = (tmin + tmax) / 2;

  let tomorrowFeel = predict(avg, 50, 10, 12);

  document.getElementById("tomorrow").innerText =
    `🌡️ ${tmin}°C / ${tmax}°C | Ressenti IA: ${tomorrowFeel.toFixed(1)}°C`;

  // ---------- ALERTES ----------
  let msg = "OK";
  if (data.current_weather.temperature > 32) msg = "🔥 Forte chaleur";
  document.getElementById("alert").innerText = msg;
}

// ---------------- FEEDBACK IA ----------------
function feedback(type) {
  let t = parseFloat(document.getElementById("temp").innerText);
  let h = parseFloat(document.getElementById("hum").innerText);
  let w = parseFloat(document.getElementById("wind").innerText);

  if (isNaN(t)) return;

  let feel = t;
  if (type === "hot") feel += 2;
  if (type === "cold") feel -= 2;

  let hour = new Date().getHours();

  memory.push({
    temp: t,
    hum: h,
    wind: w,
    hour: hour,
    feel: feel
  });

  localStorage.setItem("memory", JSON.stringify(memory));

  document.getElementById("ai").innerText =
    `IA a appris ✔ (${memory.length} données)`;
}
