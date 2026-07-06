// ---------------- SUGGESTIONS CORRIGÉES ----------------
let timeout;
async function suggestCities(){
  let input = document.getElementById("search").value;
  let box = document.getElementById("suggestions");

  // Si l'entrée est vide ou trop courte, on vide la boîte de suggestions
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

      // On vide proprement la boîte avant d'ajouter les nouveaux éléments
      box.innerHTML = "";

      if(!data.results || data.results.length === 0){
        return;
      }

      // Sécurisation : Création d'éléments HTML propres pour éviter le bug d'injection textuelle
      data.results.forEach(city => {
        let div = document.createElement("div");
        div.className = "suggestion";
        div.innerText = `${city.name} (${city.country || ""})`;
        
        // Au clic, on lance la fonction proprement sans utiliser de texte brut
        div.addEventListener("click", () => {
          selectCity(city.latitude, city.longitude, city.name);
        });

        box.appendChild(div);
      });

    } catch (error) {
      console.error("Erreur lors de la suggestion :", error);
    }
  }, 250);
}
