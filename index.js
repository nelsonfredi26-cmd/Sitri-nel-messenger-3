// ===== Bot Messenger - Étape 1 : Connexion + Keep-Alive =====

const { login } = require("biar-fca");
const express = require("express");

// --- Petit serveur web pour empêcher Render d'endormir le bot ---
const app = express();
app.get("/", (req, res) => {
  res.send("Le bot Sitri-Nel est en ligne ✅");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur keep-alive lancé sur le port ${PORT}`);
});

// --- Connexion au compte Facebook dédié au bot via appState (cookies de session) ---
// Le JSON complet est stocké dans la variable d'environnement FB_APPSTATE sur Render.
let appState;
try {
  appState = JSON.parse(process.env.FB_APPSTATE);
} catch (e) {
  console.error("Erreur : FB_APPSTATE est manquant ou n'est pas un JSON valide.");
  process.exit(1);
}

login({ appState }, (err, api) => {
  if (err) {
    console.error("Erreur de connexion à Facebook :", err);
    return;
  }

  console.log("✅ Bot connecté à Facebook avec succès !");

  // Réglages de base de l'API
  api.setOptions({
    listenEvents: true,
    selfListen: false,
  });

  // --- Écoute des messages entrants ---
  api.listenMqtt((err, event) => {
    if (err) {
      console.error("Erreur d'écoute :", err);
      return;
    }

    if (event.type === "message" && event.body) {
      const message = event.body.trim();

      // Test simple pour vérifier que ça fonctionne
      if (message.toLowerCase() === "xtest") {
        api.sendMessage("Sitri-Nel est bien connectée ✅ — créée par Nelson.", event.threadID);
      }
    }
  });
});
