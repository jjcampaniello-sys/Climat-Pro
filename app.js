let memory = JSON.parse(localStorage.getItem("memory")) || [];

let profile = JSON.parse(localStorage.getItem("profile")) || {
  type: "normal"
};

// ---------------- METEO ----------------
async function weather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,windspeed_10m,relativehumidity_2m&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
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

// ---------------- IA LEVEL (FIX STRICT) ----------------
function comfortLevel(feels) {
  if (feels < 12) return "🥶 Froid";
  if (feels < 22) return "🙂 OK";
  return "🌡️ Chaud";
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
  let hum = hourly.relativehumidity_2m?.[0] ?? 50;

  let feel = predict(temp, hum, wind);

  // ---------------- MATIN / MIDI / SOIR ----------------
  let matin = predict(temp - 2, hum, wind);
  let midi = predict(temp, hum, wind);
  let soir = predict(temp - 1, hum, wind);

  document.getElementById("temp").innerText = temp;
  document.getElementById("feel").innerText = feel.toFixed(1);
  document.getElementById("hum").innerText = hum;
  document.getElementById("wind").innerText = wind;

  document.getElementById("forecast").innerHTML =
    `🌅 Matin: ${matin.toFixed(1)}°C |
     ☀️ Midi: ${midi.toFixed(1)}°C |
     🌙 Soir: ${soir.toFixed(1)}°C`;

  // ---------------- IA FIXE ----------------
  document.getElementById("comfort").innerText =
    comfortLevel(feel);

  // ---------------- TITRE ----------------
  let title = "📊 Prévisions aujourd’hui";

  if (profile.type === "cold") title = "📊 Frileux ❄️";
  if (profile.type === "hot") title = "📊 Chaud 🔥";

  document.getElementById("forecastTitle").innerText = title;

  // ---------------- DEMAIN (FIX MIN/MAX BUG) ----------------
  let tmin =
    daily.temperature_2m_min?.[1] ??
    daily.temperature_2m_min?.[0] ??
    temp;

  let tmax =
    daily.temperature_2m_max?.[1] ??
    daily.temperature_2m_max?.[0] ??
    temp;

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

  memory.push({ temp: t, feel: t, hour: new Date().getHours() });

  localStorage.setItem("memory", JSON.stringify(memory));

  document.getElementById("ai").innerText =
    `IA apprentissage ✔ (${memory.length})`;
}

// ---------------- PROFILE ----------------
function setProfile(type) {
  profile.type = type;
  localStorage.setItem("profile", JSON.stringify(profile));
}
