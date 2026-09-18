// ===== Bot WhatsApp - Étape 1 : Connexion (Baileys) =====

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const express = require("express");

// --- Petit serveur web pour empêcher Render d'endormir le bot ---
const app = express();
app.get("/", (req, res) => {
  res.send("Le bot WhatsApp est en ligne ✅");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur keep-alive lancé sur le port ${PORT}`);
});

// Le numéro de téléphone du compte WhatsApp du bot (avec indicatif, sans + ni espaces)
// Exemple : 22990000000
const PHONE_NUMBER = process.env.WA_PHONE_NUMBER;

async function startBot() {
  // Sauvegarde la session dans le dossier "auth" pour ne pas avoir à se reconnecter à chaque redémarrage
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  // Si le compte n'est pas encore lié, on demande un code d'appairage
  if (!sock.authState.creds.registered) {
    const code = await sock.requestPairingCode(PHONE_NUMBER);
    console.log("=======================================");
    console.log("CODE D'APPAIRAGE :", code);
    console.log("=======================================");
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connexion fermée. Reconnexion :", shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === "open") {
      console.log("✅ Bot connecté à WhatsApp avec succès !");
    }
  });

  // --- Écoute des messages entrants ---
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    // Test simple pour vérifier que ça fonctionne
    if (text.trim().toLowerCase() === "xtest") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Le bot est bien connecté ✅",
      });
    }
  });
}

startBot();
