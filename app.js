let memory = JSON.parse(localStorage.getItem("memory")) || [];

// ---------------- CACHE ----------------

const CACHE_TIME = 10 * 60 * 1000; // 10 minutes

function getCacheKey(lat, lon){
return 'weather_${lat.toFixed(2)}_${lon.toFixed(2)}';
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

// 🔥 cache check
let cached = loadCache(lat, lon);
if(cached){
console.log("⚡ météo depuis cache");
return cached;
}

console.log("🌐 appel API");

const res = await fetch(
'https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,windspeed_10m,weathercode'
);

let data = await res.json();

saveCache(lat, lon, data);

return data;
}

// ---------------- IA AMÉLIORÉE ----------------

function predict(temp, hum, wind){

if(memory.length === 0) return temp;

let total = 0;
let weightSum = 0;

memory.forEach(m => {

let diff =
  Math.abs(m.temp - temp) +
  Math.abs(m.hum - hum) +
  Math.abs(m.wind - wind);

// plus c'est proche → plus ça compte
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
});
}

// ---------------- VILLE ----------------

async function searchCity(){
let city = document.getElementById("search").value;

const res = await fetch(
'https://geocoding-api.open-meteo.com/v1/search?name=${city}&count='
);

const data = await res.json();

if(data.results){
load(data.results[0].latitude, data.results[0].longitude);
}else{
alert("Ville non trouvée");
}
}

// ---------------- LOAD ----------------

async function load(lat, lon){
  try {
    let data = await weather(lat, lon);

    // Vérification de sécurité pour s'assurer que les données existent
    if (!data || !data.current_weather) {
      alert("Impossible de charger les données météo.");
      return;
    }

    let t = data.current_weather.temperature;
    let w = data.current_weather.windspeed;
    
    // Valeur de secours (50%) si l'humidité horaire est manquante
    let h = (data.hourly && data.hourly.relative_humidity_2m) ? data.hourly.relative_humidity_2m[0] : 50;

    let feel = predict(t, h, w);

    // Affichage dans le HTML
    document.getElementById("temp").innerText = t;
    document.getElementById("feel").innerText = feel.toFixed(1);
    document.getElementById("hum").innerText = h;
    document.getElementById("wind").innerText = w;

    // Lancement des autres affichages
    forecast(data);
    tomorrow(data);
    alerts(t, h);
    
  } catch (error) {
    console.error("Erreur lors du chargement :", error);
  }
}


// ---------------- PREVISIONS ----------------

function forecast(data){

let t = data.hourly.temperature_2m;
let h = data.hourly.relative_humidity_2m;
let w = data.hourly.windspeed_10m;
let code = data.hourly.weathercode;

let m = predict(t[8], h[8], w[8]);
let n = predict(t[12], h[12], w[12]);
let e = predict(t[18], h[18], w[18]);

let iconM = getIcon(code[8], w[8]);
let iconN = getIcon(code[12], w[12]);
let iconE = getIcon(code[18], w[18]);

document.getElementById("forecast").innerHTML =
'${iconM} Matin: ${m.toFixed(1)}°C<br> ${iconN} Midi: ${n.toFixed(1)}°C<br> ${iconE} Soir: ${e.toFixed(1)}°C';
}

// ---------------- DEMAIN ----------------

function tomorrow(data){

let t = data.hourly.temperature_2m[24];
let h = data.hourly.relative_humidity_2m[24];
let w = data.hourly.windspeed_10m[24];

let f = predict(t,h,w);

document.getElementById("tomorrow").innerText =
"Ressenti IA : "+f.toFixed(1)+"°C";
}

// ---------------- ALERTES ----------------

function alerts(t,h){

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

let feel = t;

if(type === "hot") feel += 2;
if(type === "cold") feel -= 2;

memory.push({
temp: t,
hum: h,
wind: w,
feel: feel
});

localStorage.setItem("memory", JSON.stringify(memory));

document.getElementById("ai").innerText =
"IA a appris ✔ (" + memory.length + " données)";
}

// ---------------- SUGGESTIONS ----------------

let timeout;

async function suggestCities(){

let input = document.getElementById("search").value;
let box = document.getElementById("suggestions");

if(input.length < 2){
box.innerHTML = "";
return;
}

clearTimeout(timeout);

timeout = setTimeout(async () => {

const res = await fetch(
  `https://geocoding-api.open-meteo.com/v1/search?name=${input}&count=5`
);

const data = await res.json();

if(!data.results){
  box.innerHTML = "";
  return;
}

box.innerHTML = data.results.map(city => `
  <div class="suggestion" onclick="selectCity(${city.latitude}, ${city.longitude}, '${city.name}')">
    ${city.name} (${city.country || ""})
  </div>
`).join("");

}, 250);
}

function selectCity(lat, lon, name){

document.getElementById("search").value = name;
document.getElementById("suggestions").innerHTML = "";
load(lat, lon);
}
