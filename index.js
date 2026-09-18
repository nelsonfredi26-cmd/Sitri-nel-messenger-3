// ===== Bot Messenger - Étape 1 : Connexion + Keep-Alive =====

const login = require("biar-fca");
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

// --- Connexion au compte Facebook dédié au bot ---
// IMPORTANT : ne jamais écrire l'email/mot de passe en clair ici.
// On les lit depuis des variables d'environnement (à définir sur Render).
const credentials = {
  email: process.env.FB_EMAIL,
  password: process.env.FB_PASSWORD,
};

login(credentials, (err, api) => {
  if (err) {
    console.error("Erreur de connexion à Facebook :", err);
    return;
  }

  console.log("✅ Bot connecté à Facebook avec succès !");

  api.setOptions({
    listenEvents: true,
    selfListen: false,
  });

  api.listenMqtt((err, event) => {
    if (err) {
      console.error("Erreur d'écoute :", err);
      return;
    }

    if (event.type === "message" && event.body) {
      const message = event.body.trim();

      if (message.toLowerCase() === "xtest") {
        api.sendMessage("Sitri-Nel est bien connectée ✅ — créée par Nelson.", event.threadID);
      }
    }
  });
});
