let memory = JSON.parse(localStorage.getItem("memory")) || [];

let profile = JSON.parse(localStorage.getItem("profile")) || {
  type: "normal"
};

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

  // été
  if (month >= 5 && month <= 8) {
    return temp - 1.2;
  }

  // hiver
  if (month <= 1 || month === 11) {
    return temp + 1.2;
  }

  return temp;
}

// ---------------- IA RESSENTI ----------------
function predict(temp, hum, wind) {

  let heat = humidex(temp, hum);
  let cold = windChill(temp, wind);

  let feels = (heat + cold) / 2;

  // profil utilisateur
  if (profile.type === "cold") feels -= 1.5;
  if (profile.type === "hot") feels += 1.5;

  // saison
  feels = seasonalAdjustment(feels);

  return feels;
}

// ---------------- GPS ----------------
function gps() {
  navigator.geolocation.getCurrentPosition(pos => {
    load(pos.coords.latitude, pos.coords.longitude);
  }, () => {
    alert("GPS indisponible ou refusé.");
  });
}

// ---------------- SEARCH ----------------
async function searchCity() {
  let city = document.getElementById("search").value;
  if (!city) return;

  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
  );

  const data = await res.json();

  if (data?.results?.length > 0) {
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
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=5`
  );

  const data = await res.json();

  box.innerHTML = "";

  data?.results?.forEach(city => {
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
});

// fermeture dropdown
document.addEventListener("click", (e) => {
  const box = document.getElementById("suggestions");
  const input = document.getElementById("search");

  if (!box.contains(e.target) && e.target !== input) {
    box.innerHTML = "";
  }
});

// ---------------- LOAD ----------------
async function load(lat, lon) {
  let data = await weather(lat, lon);

  if (!data) return;

  let hourly = data.hourly;
  let daily = data.daily;

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

  // ---------------- AFFICHAGE ----------------
  document.getElementById("temp").innerText = data.current_weather.temperature;
  document.getElementById("feel").innerText = matin.toFixed(1);
  document.getElementById("hum").innerText = hourly.relativehumidity_2m[0];
  document.getElementById("wind").innerText = data.current_weather.windspeed;

  document.getElementById("forecast").innerHTML =
    `🌅 Température ressentie matin: ${matin.toFixed(1)}°C |
     ☀️ Midi: ${midi.toFixed(1)}°C |
     🌙 Soir: ${soir.toFixed(1)}°C`;

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

  let hour = new Date().getHours();

  memory.push({
    temp: t,
    hum: h,
    wind: w,
    hour,
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
