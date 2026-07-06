let memory = JSON.parse(localStorage.getItem("memory")) || [];

let profile = JSON.parse(localStorage.getItem("profile")) || {
  type: "normal" // cold | normal | hot
};

// ---------------- METEO ----------------
async function weather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,windspeed_10m,relativehumidity_2m,time&daily=temperature_2m_max,temperature_2m_min&current_weather=true&timezone=auto`
    );
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ---------------- HUMIDEX ----------------
function humidex(temp, hum) {
  return temp + (hum / 100) * 6;
}

// ---------------- WIND CHILL ----------------
function windChill(temp, wind) {
  if (wind < 5) return temp;
  return temp - wind * 0.15;
}

// ---------------- SAISON ----------------
function seasonalAdjustment(temp) {
  let month = new Date().getMonth();

  if (month >= 5 && month <= 8) return temp - 1.2; // été
  if (month <= 1 || month === 11) return temp + 1.2; // hiver

  return temp;
}

// ---------------- MODELE IA ----------------
function predict(temp, hum, wind) {
  let heat = humidex(temp, hum);
  let cold = windChill(temp, wind);

  let feels = (heat + cold) / 2;

  if (profile.type === "cold") feels -= 1.5;
  if (profile.type === "hot") feels += 1.5;

  feels = seasonalAdjustment(feels);

  return feels;
}

// ---------------- COMFORT ----------------
function comfortLevel(feels) {
  if (feels < 5) return "🥶 Très froid";
  if (feels < 12) return "🧊 Froid confortable";
  if (feels < 20) return "🌤️ Idéal";
  if (feels < 27) return "🌡️ Chaud";
  return "🥵 Inconfort chaud";
}

// ---------------- INDEX SAFE (IMPORTANT FIX) ----------------
function findIndex(hourly, hourTarget) {
  if (!hourly || !hourly.time) return 0;

  for (let i = 0; i < hourly.time.length; i++) {
    let d = new Date(hourly.time[i]);
    if (d.getHours() === hourTarget) return i;
  }

  return 0;
}

// ---------------- GPS ----------------
function gps() {
  navigator.geolocation.getCurrentPosition(async pos => {
    load(pos.coords.latitude, pos.coords.longitude);
  }, () => {
    alert("GPS indisponible ou refusé.");
  });
}

// ---------------- SEARCH ----------------
async function searchCity() {
  let city = document.getElementById("search").value;
  if (!city) return;

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`
    );

    const data = await res.json();

    if (data?.results?.length > 0) {
      let r = data.results[0];
      load(r.latitude, r.longitude);
    } else {
      alert("Ville non trouvée");
    }
  } catch (e) {
    alert("Erreur API géocoding");
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

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=5&language=fr`
    );

    const data = await res.json();

    box.innerHTML = "";

    if (!data || !data.results) return;

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

  } catch (e) {
    console.log("suggest error");
  }
}

// fermeture dropdown
document.addEventListener("click", (e) => {
  const box = document.getElementById("suggestions");
  const input = document.getElementById("search");

  if (box && !box.contains(e.target) && e.target !== input) {
    box.innerHTML = "";
  }
});

// ---------------- LOAD ----------------
async function load(lat, lon) {
  let data = await weather(lat, lon);
  if (!data || !data.hourly) return;

  let hourly = data.hourly;
  let daily = data.daily;

  let iMatin = findIndex(hourly, 8);
  let iMidi = findIndex(hourly, 13);
  let iSoir = findIndex(hourly, 20);

  let matin = predict(
    hourly.temperature_2m[iMatin],
    hourly.relativehumidity_2m[iMatin],
    hourly.windspeed_10m[iMatin]
  );

  let midi = predict(
    hourly.temperature_2m[iMidi],
    hourly.relativehumidity_2m[iMidi],
    hourly.windspeed_10m[iMidi]
  );

  let soir = predict(
    hourly.temperature_2m[iSoir],
    hourly.relativehumidity_2m[iSoir],
    hourly.windspeed_10m[iSoir]
  );

  // ---------------- TITLE DYNAMIQUE ----------------
  let avgWind = data.current_weather.windspeed;

  let title = "📊 Prévisions aujourd’hui";

  if (profile.type === "cold") {
    title = "📊 Prévisions aujourd’hui (frileux ❄️)";
  }

  if (avgWind > 25) {
    title = "📊 Prévisions aujourd’hui (vent fort 🌬️)";
  }

  let avgComfort = (matin + midi + soir) / 3;

  if (avgComfort >= 18 && avgComfort <= 24 && avgWind < 15) {
    title = "📊 Prévisions aujourd’hui (confort idéal 🌤️)";
  }

  let titleEl = document.getElementById("forecastTitle");
  if (titleEl) titleEl.innerText = title;

  // ---------------- UI ----------------
  document.getElementById("temp").innerText = data.current_weather.temperature;
  document.getElementById("feel").innerText = matin.toFixed(1);
  document.getElementById("hum").innerText = hourly.relativehumidity_2m[0];
  document.getElementById("wind").innerText = avgWind;

  document.getElementById("forecast").innerHTML =
    `🌅 Matin: ${matin.toFixed(1)}°C |
     ☀️ Midi: ${midi.toFixed(1)}°C |
     🌙 Soir: ${soir.toFixed(1)}°C`;

  let comfort = comfortLevel(avgComfort);
  let comfortEl = document.getElementById("comfort");
  if (comfortEl) comfortEl.innerText = comfort;

  // ---------------- DEMAIN ----------------
  let tmin = daily.temperature_2m_min[1];
  let tmax = daily.temperature_2m_max[1];

  let avg = (tmin + tmax) / 2;
  let tomorrow = predict(avg, 50, 10);

  document.getElementById("tomorrow").innerText =
    `🌡️ Demain: ${tmin}°C / ${tmax}°C | Ressenti: ${tomorrow.toFixed(1)}°C`;

  // ---------------- ALERTES ----------------
  let msg = "OK";
  if (data.current_weather.temperature > 32) msg = "🔥 Forte chaleur";

  document.getElementById("alert").innerText = msg;
}

// ---------------- FEEDBACK ----------------
function feedback(type) {
  let t = parseFloat(document.getElementById("temp").innerText);
  let h = parseFloat(document.getElementById("hum").innerText);
  let w = parseFloat(document.getElementById("wind").innerText);

  if (isNaN(t)) return;

  let feel = t;

  if (type === "hot") feel += 2;
  if (type === "cold") feel -= 2;

  memory.push({
    temp: t,
    hum: h,
    wind: w,
    hour: new Date().getHours(),
    feel
  });

  localStorage.setItem("memory", JSON.stringify(memory));

  document.getElementById("ai").innerText =
    `IA apprentissage ✔ (${memory.length})`;
}

// ---------------- PROFIL ----------------
function setProfile(type) {
  profile.type = type;
  localStorage.setItem("profile", JSON.stringify(profile));
}
