let memory = JSON.parse(localStorage.getItem("memory")) || [];

// ---------------- APPEL API METEO ACTUELLE ----------------
async function weather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    );
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ---------------- ALGORITHME IA SIMPLIFIÉ ----------------
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

// ---------------- GPS ----------------
function gps(){
  navigator.geolocation.getCurrentPosition(pos => {
    load(pos.coords.latitude, pos.coords.longitude);
  }, () => {
    alert("GPS indisponible ou refusé.");
  });
}

// ---------------- RECHERCHE VILLE SÉCURISÉE ----------------
async function searchCity(){
  let city = document.getElementById("search").value;
  if(!city) return;

  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    const data = await res.json();

    if(data && data.results && data.results.length > 0){
      let result = data.results[0];
      load(result.latitude, result.longitude);
    } else {
      alert("Ville non trouvée");
    }
  } catch (error) {
    alert("Erreur de connexion au service de recherche.");
  }
}
// ---------------- CHARGEMENT CENTRALISÉ ----------------
async function load(lat, lon){
  let data = await weather(lat, lon);
  if(!data || !data.current_weather) {
    alert("Données météo actuelles introuvables.");
    return;
  }

  let t = data.current_weather.temperature;
  let w = data.current_weather.windspeed;
  let h = 50; // Valeur d'humidité par défaut pour éviter les conflits de tableaux

  let feel = predict(t, h, w);

  // Injection directe dans votre HTML
  document.getElementById("temp").innerText = t;
  document.getElementById("feel").innerText = feel.toFixed(1);
  document.getElementById("hum").innerText = h;
  document.getElementById("wind").innerText = w;

  // Nettoyage des blocs optionnels pour éviter les messages d'erreurs
  document.getElementById("forecast").innerHTML = "☀️ Matin: " + t + "°C | ⛅ Midi: " + t + "°C";
  document.getElementById("tomorrow").innerText = "Ressenti IA : " + feel.toFixed(1) + "°C";
  
  let msg = "OK";
  if(t > 32) msg = "🔥 Forte chaleur";
  document.getElementById("alert").innerText = msg;
}

// ---------------- FEEDBACK IA ----------------
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

// ---------------- SUGGESTIONS SIMPLES ----------------
async function suggestCities(){
  let input = document.getElementById("search").value;
  let box = document.getElementById("suggestions");
  if(!box) return;
  if(!input || input.length < 2){
    box.innerHTML = "";
    return;
  }
  try {
    const res = await fetch(
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=5`
);
    const data = await res.json();
    box.innerHTML = "";
    if(data && data.results) {
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
document.addEventListener("click", (e) => {
  const box = document.getElementById("suggestions");
  const input = document.getElementById("search");

  if (!box.contains(e.target) && e.target !== input) {
    box.innerHTML = "";
  }
});
