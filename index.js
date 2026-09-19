// ===== Bot WhatsApp Sitri-Nel - Connexion via Baileys + MongoDB (auth maison) =====

const {
  default: makeWASocket,
  DisconnectReason,
  Browsers,
  initAuthCreds,
  BufferJSON,
  proto,
} = require("@whiskeysockets/baileys");
const { MongoClient } = require("mongodb");
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

const PHONE_NUMBER = process.env.WA_PHONE_NUMBER;
const MONGODB_URI = process.env.MONGODB_URI;

// --- Stockage de la session WhatsApp dans MongoDB (remplace les fichiers locaux) ---
async function useMongoAuthState(collection) {
  const writeData = async (data, id) => {
    const doc = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
    await collection.updateOne(
      { _id: id },
      { $set: { data: doc } },
      { upsert: true }
    );
  };

  const readData = async (id) => {
    try {
      const doc = await collection.findOne({ _id: id });
      if (!doc) return null;
      return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const removeData = async (id) => {
    await collection.deleteOne({ _id: id });
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData(creds, "creds"),
  };
}

let authCollection;

async function startBot() {
  if (!authCollection) {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db("sitri-nel");
    authCollection = db.collection("authState");
    console.log("✅ Connecté à MongoDB");
  }

  const { state, saveCreds } = await useMongoAuthState(authCollection);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
  });

  if (!sock.authState.creds.registered) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
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
    const command = text.trim().toLowerCase();

    if (command === "xtest") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "🧬 Sitri-Nel 🫟\nLe bot est bien connecté ✅",
      });
    }

    if (command === "xmenu") {
      await sock.sendMessage(msg.key.remoteJid, {
        text:
          "🧬 Sitri-Nel 🫟\n" +
          "━━━━━━━━━━━━━━\n" +
          "🧠 Intelligence & Chat\n" +
          "💰 Économie\n" +
          "🎮 Jeux\n" +
          "🛡️ Administration\n" +
          "🖼️ Médias\n" +
          "━━━━━━━━━━━━━━\n" +
          "𖤍𝐾𝚊𝚢≈𝚍𝚎𝚗𖤍",
      });
    }

    if (command === "xinfo") {
      await sock.sendMessage(msg.key.remoteJid, {
        text:
          "🧬 Sitri-Nel 🫟\n\n" +
          "Je suis Sitri-Nel, une IA conçue pour ce groupe : je discute, je réponds à vos questions, " +
          "j'anime des quiz et duels, je gère une économie de XCoins, je modère, je génère des images " +
          "et transforme vos photos en stickers.\n\n" +
          "⏳ still learning, always improving.\n\n" +
          "Created by 𖤍𝐾𝚊𝚢≈𝚍𝚎𝚗𖤍",
      });
    }
  });
}

startBot();
           
