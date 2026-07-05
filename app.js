let memory = JSON.parse(localStorage.getItem("memory")) || [];

async function weather(lat, lon){
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,windspeed_10m`);
  return await res.json();
}

function predict(temp, hum, wind){

  if(memory.length === 0) return temp;

  let total = 0;
  let count = 0;

  memory.forEach(m => {
    let diff = Math.abs(m.temp-temp)+Math.abs(m.hum-hum)+Math.abs(m.wind-wind);
    if(diff < 20){
      total += m.feel;
      count++;
    }
  });

  if(count === 0) return temp;
  return total / count;
}

function gps(){
  navigator.geolocation.getCurrentPosition(pos=>{
    load(pos.coords.latitude,pos.coords.longitude);
  });
}

async function searchCity(){
  let city = document.getElementById("search").value;

  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
  const data = await res.json();

  if(data.results){
    load(data.results[0].latitude,data.results[0].longitude);
  }else{
    alert("Ville non trouvée");
  }
}

async function load(lat, lon){

  let data = await weather(lat, lon);

  let t = data.current_weather.temperature;
  let w = data.current_weather.windspeed;
  let h = data.hourly.relative_humidity_2m[0];

  let feel = predict(t,h,w);

  document.getElementById("temp").innerText = t;
  document.getElementById("feel").innerText = feel.toFixed(1);
  document.getElementById("hum").innerText = h;
  document.getElementById("wind").innerText = w;

  forecast(data);
  tomorrow(data);
  alerts(t,h);
}

function forecast(data){
  let temps = data.hourly.temperature_2m;
  document.getElementById("forecast").innerText =
  `Matin: ${temps[8]}°C | Midi: ${temps[12]}°C | Soir: ${temps[18]}°C`;
}

function tomorrow(data){
  let t = data.hourly.temperature_2m[24];
  let h = data.hourly.relative_humidity_2m[24];
  let w = data.hourly.windspeed_10m[24];

  let f = predict(t,h,w);

  document.getElementById("tomorrow").innerText =
  "Ressenti IA : "+f.toFixed(1)+"°C";
}

function alerts(t,h){
  let msg="OK";
  if(t>32) msg="🔥 Forte chaleur";
  if(h>85) msg="💧 Humidité élevée";
  document.getElementById("alert").innerText=msg;
}

function feedback(type){

  let t=parseFloat(document.getElementById("temp").innerText);
  let h=parseFloat(document.getElementById("hum").innerText);
  let w=parseFloat(document.getElementById("wind").innerText);

  let feel=t;
  if(type==="hot") feel+=2;
  if(type==="cold") feel-=2;

  memory.push({temp:t,hum:h,wind:w,feel});
  localStorage.setItem("memory",JSON.stringify(memory));

  document.getElementById("ai").innerText =
  "IA a appris ✔ ("+memory.length+")";
}

/* ===== Suggestions villes ===== */

let timeout;

async function suggestCities(){

  let input=document.getElementById("search").value;
  let box=document.getElementById("suggestions");

  if(input.length<2){
    box.innerHTML="";
    return;
  }

  clearTimeout(timeout);

  timeout=setTimeout(async()=>{

    const res=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${input}&count=5`);
    const data=await res.json();

    if(!data.results){
      box.innerHTML="";
      return;
    }

    box.innerHTML=data.results.map(c=>
      `<div class="suggestion" onclick="selectCity(${c.latitude},${c.longitude},'${c.name}')">
        ${c.name} ${c.country||""}
      </div>`
    ).join("");

  },250);
}

function selectCity(lat,lon,name){
  document.getElementById("search").value=name;
  document.getElementById("suggestions").innerHTML="";
  load(lat,lon);
}
