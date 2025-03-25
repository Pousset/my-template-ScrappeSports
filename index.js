require("dotenv").config(); // Charger les variables d'environnement
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
} = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Charger les URLs depuis le fichier .env
const LEQUIPE_URL = process.env.LEQUIPE_URL;

// Extraire les dates des URLs
const lequipeDate = LEQUIPE_URL.split("/Directs/")[1] || "Date inconnue";

// Créez une instance du client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Enregistrement de la commande /resultats
const commands = [
  new SlashCommandBuilder()
    .setName("resultats")
    .setDescription("Affiche les résultats des matchs."),
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("Commandes enregistrées avec succès !");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes :", error);
  }
})();

// Fonction pour scraper tous les sports depuis L'Équipe
async function fetchAllSportsResults() {
  try {
    const response = await axios.get(LEQUIPE_URL);
    const $ = cheerio.load(response.data);

    const date = LEQUIPE_URL.split("/Directs/")[1] || "Date inconnue";

    const sportsLinks = [];
    $("a.Link.LiveListingWidget__title").each((_, element) => {
      const sportName = $(element).text().trim();
      const sportLink = $(element).attr("href");
      if (sportName && sportLink) {
        sportsLinks.push({
          name: sportName,
          url: `https://www.lequipe.fr${sportLink}`,
        });
      }
    });

    if (sportsLinks.length === 0) {
      console.log("Aucun sport trouvé sur la page.");
      return;
    }

    for (const sport of sportsLinks) {
      const sportResponse = await axios.get(sport.url);
      const sportPage = cheerio.load(sportResponse.data);

      const results = [];
      sportPage(".SportEventWidget--match").each((_, element) => {
        const homeTeam = sportPage(element)
          .find(".TeamScore__team--home .TeamScore__nameshort span:first-child")
          .text()
          .trim();
        const awayTeam = sportPage(element)
          .find(".TeamScore__team--away .TeamScore__nameshort span:first-child")
          .text()
          .trim();
        const homeScore =
          sportPage(element).find(".TeamScore__score--home").text().trim() ||
          "N/A";
        const awayScore =
          sportPage(element).find(".TeamScore__score--away").text().trim() ||
          "N/A";
        const time =
          sportPage(element).find(".TeamScore__schedule span").text().trim() ||
          "N/A";

        results.push({ homeTeam, awayTeam, homeScore, awayScore, time });
      });

      if (results.length === 0) {
        console.log(`Aucun résultat trouvé pour le sport : ${sport.name}`);
        continue;
      }

      let output = `# URL : ${LEQUIPE_URL}\n`;
      output += `Résultats des matchs de ${sport.name} (${date}) :\n`;
      results.forEach((result, index) => {
        output += `${index + 1}. ${result.homeTeam} (${result.homeScore}) vs ${
          result.awayTeam
        } (${result.awayScore})\n   Heure : ${result.time}\n\n`;
      });

      const fileName = path.join(
        __dirname,
        "data",
        `resultats_${sport.name.toLowerCase().replace(/ /g, "_")}.txt`
      );
      fs.writeFileSync(fileName, output, "utf8");
      console.log(
        `Résultats de ${sport.name} enregistrés pour la date : ${date}`
      );
    }

    console.log("Tous les fichiers ont été créés.");
  } catch (error) {
    console.error("Erreur lors du scraping de L'Équipe :", error);
  }
}

// Fonction pour nettoyer les fichiers obsolètes
function cleanObsoleteFiles(currentUrl) {
  const dataFolderPath = path.join(__dirname, "data");
  const files = fs
    .readdirSync(dataFolderPath)
    .filter((file) => file.endsWith(".txt"));

  files.forEach((file) => {
    const filePath = path.join(dataFolderPath, file);
    const content = fs.readFileSync(filePath, "utf8");

    const urlMatch = content.match(/^# URL : (.+)$/m);
    if (!urlMatch || urlMatch[1] !== currentUrl) {
      console.log(`Suppression du fichier obsolète : ${file}`);
      fs.unlinkSync(filePath);
    }
  });
}

// Fonction pour reformater les fichiers existants
function reformatExistingFiles() {
  const dataFolderPath = path.join(__dirname, "data");
  const files = fs
    .readdirSync(dataFolderPath)
    .filter((file) => file.endsWith(".txt"));

  files.forEach((file) => {
    const filePath = path.join(dataFolderPath, file);
    const content = fs.readFileSync(filePath, "utf8");

    // Reformater le contenu
    const lines = content
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "));
    const reformattedContent = lines.join("\n");

    fs.writeFileSync(filePath, reformattedContent, "utf8");
    console.log(`Le fichier ${file} a été reformatté.`);
  });
}

// Fonction pour s'assurer que le dossier 'data' existe
const ensureDataFolderExists = () => {
  const dataFolderPath = path.join(__dirname, "data");
  if (!fs.existsSync(dataFolderPath)) {
    fs.mkdirSync(dataFolderPath);
    console.log("Dossier 'data' créé.");
  }
};

// Événement déclenché lorsque le bot est prêt
client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  // Vérifier et créer le dossier 'data' si nécessaire
  ensureDataFolderExists();

  // Nettoyer les fichiers obsolètes
  cleanObsoleteFiles(LEQUIPE_URL);

  // Reformater les fichiers existants
  reformatExistingFiles();

  // Lancer le scraping
  fetchAllSportsResults();
});

// Gérer les interactions avec les commandes
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "resultats") {
    try {
      // Lire le contenu du fichier L'Équipe
      const results = fs.readFileSync("resultats_lequipe.txt", "utf8");

      // Diviser les résultats par match
      const matches = results.split("\n\n"); // Chaque match est séparé par une ligne vide

      let currentMessage = "```";
      const messages = [];

      for (const match of matches) {
        // Ajouter le match au message actuel si cela ne dépasse pas 2000 caractères
        if ((currentMessage + match + "\n\n```").length <= 2000) {
          currentMessage += match + "\n\n";
        } else {
          // Si le message dépasse 2000 caractères, sauvegarder le message actuel et commencer un nouveau
          currentMessage += "```";
          messages.push(currentMessage);
          currentMessage = "```" + match + "\n\n";
        }
      }

      // Ajouter le dernier message restant
      if (currentMessage !== "```") {
        currentMessage += "```";
        messages.push(currentMessage);
      }

      // Envoyer les messages un par un
      for (let i = 0; i < messages.length; i++) {
        if (i === 0) {
          // Répondre au premier message
          await interaction.reply(messages[i]);
        } else {
          // Envoyer les messages suivants
          await interaction.followUp(messages[i]);
        }
      }
    } catch (error) {
      await interaction.reply("Impossible de lire les résultats.");
    }
  }
});

// Route pour afficher la page HTML regroupant les données des fichiers .txt
app.get("/", (req, res) => {
  const files = fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith(".txt"));

  // Extraire les dates des URLs
  const lequipeDate = LEQUIPE_URL.split("/Directs/")[1] || "Date inconnue";

  let htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Résultats des Matchs</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 20px;
          background-color: #f9f9f9;
        }
        h1 {
          text-align: center;
          color: #333;
        }
        .date-info {
          text-align: center;
          margin-bottom: 20px;
          font-size: 18px;
          color: #555;
        }
        .file-section {
          margin-bottom: 40px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          background-color: #fff;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: center;
        }
        th {
          background-color: #007bff;
          color: white;
          font-weight: bold;
          text-transform: uppercase;
        }
        tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        tr:hover {
          background-color: #e9f5ff;
        }
        td {
          color: #555;
        }
        .file-section h2 {
          color: #007bff;
          margin-bottom: 10px;
        }
      </style>
    </head>
    <body>
      <h1>Résultats des Matchs</h1>
      <div class="date-info">
        <p>Date L'Équipe : ${lequipeDate}</p>
      </div>
  `;

  files.forEach((file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const rows = fileContent.split("\n").filter((line) => line.trim() !== "");

      htmlContent += `
        <div class="file-section">
          <h2>${file}</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Team A</th>
                <th>Team B</th>
                <th>Score Team A</th>
                <th>Score Team B</th>
                <th>Vainqueur</th>
              </tr>
            </thead>
            <tbody>
      `;

      rows.forEach((row) => {
        const matchParts = row.split("Heure :")[0].trim();
        const matchRegex =
          /^(\d+)\.\s+(.+?)\s+\((\d*|N\/A)\)\s+vs\s+(.+?)\s+\((\d*|N\/A)\)\s*(Heure\s*:\s*(.+))?$/;
        const matchData = matchParts.match(matchRegex);

        if (matchData) {
          const [, index, teamA, scoreA, teamB, scoreB] = matchData;
          const winner =
            scoreA && scoreB
              ? parseInt(scoreA) > parseInt(scoreB)
                ? teamA.trim()
                : parseInt(scoreB) > parseInt(scoreA)
                ? teamB.trim()
                : "Égalité"
              : "Match non joué";

          htmlContent += `
            <tr>
              <td>${index}</td>
              <td>${teamA.trim()}</td>
              <td>${teamB.trim()}</td>
              <td>${scoreA || "N/A"}</td>
              <td>${scoreB || "N/A"}</td>
              <td>${winner}</td>
            </tr>
          `;
        }
      });

      htmlContent += `
            </tbody>
          </table>
        </div>
      `;
    } else {
      htmlContent += `
        <div class="file-section">
          <h2>${file}</h2>
          <p>Fichier introuvable.</p>
        </div>
      `;
    }
  });

  htmlContent += `
    </body>
    </html>
  `;

  res.send(htmlContent);
});

// Démarrez le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});

// Connectez le bot
client.login(TOKEN).catch(console.error);
