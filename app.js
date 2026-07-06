let memory = JSON.parse(localStorage.getItem("memory")) || [];

// ---------------- API ----------------
async function weather(lat, lon){
  try {
    const res = await fetch(
      `https://open-meteo.com{lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,windspeed_10m,weathercode`
    );
    return await res.json();
  } catch (e) {
    console.error("Erreur API Météo:", e);
    return null;
  }
}

// ---------------- IA CONTROLE ----------------
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
    alert("Géolocalisation refusée.");
  });
}

// ---------------- RECHERCHE VILLE (CORRIGÉE) ----------------
async function searchCity(){
  let city = document.getElementById("search").value;
  if(!city) return;

  try {
    const res = await fetch(
      `https://open-meteo.com{encodeURIComponent(city)}&count=1`
    );
    const data = await res.json();

    // AJOUT DES [0] ICI POUR LIRE LE PREMIER RÉSULTAT DU TABLEAU
    if(data.results && data.results.length > 0){
      load(data.results[0].latitude, data.results[0].longitude);
      let box = document.getElementById("suggestions");
      if(box) box.innerHTML = "";
    } else {
      alert("Ville non trouvée");
    }
  } catch (error) {
    console.error("Erreur Geocoding:", error);
  }
}


// ---------------- CENTRALISATION DU CHARGEMENT ----------------
// ---------------- LOAD REVISITÉ ----------------
async function load(lat, lon){
  let data = await weather(lat, lon);
  
  if(!data || !data.current_weather || !data.hourly) {
    alert("Données météo introuvables.");
    return;
  }

  let t = data.current_weather.temperature;
  let w = data.current_weather.windspeed;
  
  // Récupération sécurisée de l'humidité actuelle (index 0 du tableau)
  let h = data.hourly.relative_humidity_2m ? data.hourly.relative_humidity_2m[0] : 50;

  let feel = predict(t, h, w);

  document.getElementById("temp").innerText = t;
  document.getElementById("feel").innerText = feel.toFixed(1);
  document.getElementById("hum").innerText = h;
  document.getElementById("wind").innerText = w;

  forecast(data);
  tomorrow(data);
  alerts(t, h);
}

// ---------------- PREVISIONS DU JOUR (MATIN, MIDI, SOIR) ----------------
function forecast(data){
  if(!data.hourly || !data.hourly.temperature_2m) return;
  
  let tempTab = data.hourly.temperature_2m;
  let humTab = data.hourly.relative_humidity_2m || [];
  let windTab = data.hourly.windspeed_10m || [];
  let codeTab = data.hourly.weathercode || [];

  // Extraction des valeurs spécifiques aux bons index horaires (8h, 12h, 18h)
  let tMatin = tempTab[8] !== undefined ? tempTab[8] : 15;
  let tMidi = tempTab[12] !== undefined ? tempTab[12] : 20;
  let tSoir = tempTab[18] !== undefined ? tempTab[18] : 17;

  let hMatin = humTab[8] || 60;
  let hMidi = humTab[12] || 50;
  let hSoir = humTab[18] || 55;

  let wMatin = windTab[8] || 10;
  let wMidi = windTab[12] || 15;
  let wSoir = windTab[18] || 12;

  // Calcul du ressenti IA pour chaque moment de la journée
  let feelMatin = predict(tMatin, hMatin, wMatin);
  let feelMidi = predict(tMidi, hMidi, wMidi);
  let feelSoir = predict(tSoir, hSoir, wSoir);

  // Sélection des icônes correspondantes
  let iconMatin = getIcon(codeTab[8] || 0, wMatin);
  let iconMidi = getIcon(codeTab[12] || 0, wMidi);
  let iconSoir = getIcon(codeTab[18] || 0, wSoir);

  // Affichage final dans la carte HTML
  document.getElementById("forecast").innerHTML =
    `${iconMatin} Matin : ${tMatin}°C (Ressenti IA : ${feelMatin.toFixed(1)}°C)<br>
     ${iconMidi} Midi : ${tMidi}°C (Ressenti IA : ${feelMidi.toFixed(1)}°C)<br>
     ${iconSoir} Soir : ${tSoir}°C (Ressenti IA : ${feelSoir.toFixed(1)}°C)`;
}


// ---------------- DEMAIN ----------------
function tomorrow(data){
  if(!data.hourly || !data.hourly.temperature_2m) return;
  let t = data.hourly.temperature_2m[24] || 15;
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

// ---------------- APPRENTISSAGE IA ----------------
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

// ---------------- SUGGESTIONS AUTOMATIQUES ----------------
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
      // CORRECTION ICI : Utilisation de la bonne adresse Geocoding et des backticks complets avec $
      const res = await fetch(
        `https://open-meteo.com{encodeURIComponent(input)}&count=5`
      );
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
    } catch (err) {
      console.error(err);
    }
  }, 250);
}

