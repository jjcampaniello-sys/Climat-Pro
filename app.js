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

// ---------------- IA MODEL ----------------
function predict(temp, hum, wind) {
  if (temp == null || isNaN(temp)) temp = 0;
  if (hum == null || isNaN(hum)) hum = 50;
  if (wind == null || isNaN(wind)) wind = 5;

  let feels =
    (temp + (hum / 100) * 6 + temp - wind * 0.15) / 2;

  if (profile.type === "cold") feels -= 1.5;
  if (profile.type === "hot") feels += 1.5;

  let month = new Date().getMonth();
  if (month >= 5 && month <= 8) feels -= 1.2;
  if (month <= 1 || month === 11) feels += 1.2;

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

// ---------------- GPS ----------------
function gps() {
  navigator.geolocation.getCurrentPosition(
    pos => load(pos.coords.latitude, pos.coords.longitude),
    () => alert("GPS indisponible ou refusé.")
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
    alert("Ville non trouvée");
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

  let hourly = data.hourly || {};
  let daily = data.daily || {};
  let current = data.current_weather || {};

  let temp = current.temperature ?? 0;
  let wind = current.windspeed ?? 5;
  let hum = hourly.relativehumidity_2m?.[0] ?? 50;

  let matin = predict(temp, hum, wind);
  let midi = predict(temp, hum, wind);
  let soir = predict(temp, hum, wind);

  // ---------------- UI ----------------
  document.getElementById("temp").innerText = temp;
  document.getElementById("feel").innerText = matin.toFixed(1);
  document.getElementById("hum").innerText = hum;
  document.getElementById("wind").innerText = wind;

  document.getElementById("forecast").innerHTML =
    `🌅 Matin: ${matin.toFixed(1)}°C |
     ☀️ Midi: ${midi.toFixed(1)}°C |
     🌙 Soir: ${soir.toFixed(1)}°C`;

  // ---------------- IA CONFORT ----------------
  let avg = (matin + midi + soir) / 3;

  let comfort = comfortLevel(avg);
  document.getElementById("comfort").innerText = comfort;

  // ---------------- TITRE DYNAMIQUE ----------------
  let title = "📊 Prévisions aujourd’hui";

  if (profile.type === "cold") title = "📊 Frileux ❄️";
  if (wind > 25) title = "📊 Vent fort 🌬️";
  if (avg >= 18 && avg <= 24 && wind < 15)
    title = "📊 Confort idéal 🌤️";

  document.getElementById("forecastTitle").innerText = title;

  // ---------------- DEMAIN ----------------
  let tmin = daily.temperature_2m_min?.[1] ?? 0;
  let tmax = daily.temperature_2m_max?.[1] ?? 0;

  let tomorrow = predict((tmin + tmax) / 2, 50, 10);

  document.getElementById("tomorrow").innerText =
    `🌡️ Demain: ${tmin}°C / ${tmax}°C | Ressenti: ${tomorrow.toFixed(1)}°C`;

  // ---------------- ALERT ----------------
  document.getElementById("alert").innerText =
    temp > 32 ? "🔥 Forte chaleur" : "OK";
}

// ---------------- FEEDBACK ----------------
function feedback(type) {
  let t = parseFloat(document.getElementById("temp").innerText);

  if (isNaN(t)) return;

  let feel = t;

  if (type === "hot") feel += 2;
  if (type === "cold") feel -= 2;

  memory.push({
    temp: t,
    hour: new Date().getHours(),
    feel
  });

  localStorage.setItem("memory", JSON.stringify(memory));

  document.getElementById("ai").innerText =
    `IA apprentissage ✔ (${memory.length})`;
}

// ---------------- PROFILE ----------------
function setProfile(type) {
  profile.type = type;
  localStorage.setItem("profile", JSON.stringify(profile));
}
