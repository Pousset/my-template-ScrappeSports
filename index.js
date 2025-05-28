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
const moment = require("moment"); // Installez moment.js pour manipuler les dates : npm install moment

const app = express();
const PORT = 3000;


// Charger les URLs depuis le fichier .env
const LEQUIPE_URL = process.env.LEQUIPE_URL;

// Créez une instance du client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Fonction pour réinitialiser le dossier 'data'
function resetDataFolder() {
  const dataFolderPath = path.join(__dirname, "data");

  // Supprimer le dossier 'data' s'il existe
  if (fs.existsSync(dataFolderPath)) {
    fs.rmSync(dataFolderPath, { recursive: true, force: true });
    console.log("Dossier 'data' supprimé.");
  }

  // Recréer le dossier 'data'
  fs.mkdirSync(dataFolderPath);
  console.log("Dossier 'data' recréé.");
}

// Fonction pour extraire la date de l'URL
function extractDateFromUrl(url) {
  const match = url.match(/\/Directs\/(\d{8})/);
  return match ? match[1] : null;
}

// Fonction pour générer des URLs
function generateUrls(baseUrl, startDate, daysBefore, daysAfter) {
  const urls = [];
  const start = moment(startDate).subtract(daysBefore, "days");
  const end = moment(startDate).add(daysAfter, "days");

  for (
    let date = start.clone();
    date.isSameOrBefore(end);
    date.add(1, "days")
  ) {
    const formattedDate = date.format("YYYYMMDD");
    urls.push(`${baseUrl}${formattedDate}`);
  }

  return urls;
}

// Fonction pour s'assurer que le dossier pour un sport existe
const ensureSportFolderExists = (sportName) => {
  const sportFolderPath = path.join(
    __dirname,
    "data",
    sportName.toLowerCase().replace(/ /g, "_")
  );
  if (!fs.existsSync(sportFolderPath)) {
    fs.mkdirSync(sportFolderPath);
    console.log(`Dossier pour le sport '${sportName}' créé.`);
  }
  return sportFolderPath;
};

// Fonction pour scraper tous les sports depuis L'Équipe
async function fetchAllSportsResults(urls) {
  try {
    const allResults = await Promise.all(
      urls.map(async (url) => {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const date = url.split("/Directs/")[1] || "Date inconnue";

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
          console.log(`Aucun sport trouvé pour la date : ${date}`);
          return;
        }

        for (const sport of sportsLinks) {
          const sportResponse = await axios.get(sport.url);
          const sportPage = cheerio.load(sportResponse.data);

          const results = [];
          sportPage(".SportEventWidget--match").each((_, element) => {
            const homeTeam = sportPage(element)
              .find(
                ".TeamScore__team--home .TeamScore__nameshort span:first-child"
              )
              .text()
              .trim();
            const awayTeam = sportPage(element)
              .find(
                ".TeamScore__team--away .TeamScore__nameshort span:first-child"
              )
              .text()
              .trim();
            const homeScore =
              sportPage(element)
                .find(".TeamScore__score--home")
                .text()
                .trim() || "N/A";
            const awayScore =
              sportPage(element)
                .find(".TeamScore__score--away")
                .text()
                .trim() || "N/A";
            const time =
              sportPage(element)
                .find(".TeamScore__schedule span")
                .text()
                .trim() || "N/A";

            results.push({ homeTeam, awayTeam, homeScore, awayScore, time });
          });

          if (results.length === 0) {
            console.log(`Aucun résultat trouvé pour le sport : ${sport.name}`);
            continue;
          }

          // Créer un dossier pour le sport
          const sportFolderPath = ensureSportFolderExists(sport.name);

          let output = `# URL : ${url}\n`;
          output += `Résultats des matchs de ${sport.name} (${date}) :\n`;
          results.forEach((result, index) => {
            output += `${index + 1}. ${result.homeTeam} (${
              result.homeScore
            }) vs ${result.awayTeam} (${result.awayScore})\n   Heure : ${
              result.time
            }\n\n`;
          });

          const fileName = path.join(
            sportFolderPath,
            `resultats_${sport.name
              .toLowerCase()
              .replace(/ /g, "_")}_${date}.txt`
          );
          fs.writeFileSync(fileName, output, "utf8");
          console.log(
            `Résultats de ${sport.name} enregistrés pour la date : ${date}`
          );
        }
      })
    );

    console.log("Tous les fichiers ont été créés.");
  } catch (error) {
    console.error("Erreur lors du scraping :", error);
  }
}

// Événement déclenché lorsque le bot est prêt
client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  // Réinitialiser le dossier 'data'
  resetDataFolder();

  // Générer les URLs pour une plage de dates en se basant sur l'URL dans .env
  const baseUrl = LEQUIPE_URL.split("/Directs/")[0] + "/Directs/";
  const startDate = extractDateFromUrl(LEQUIPE_URL); // Extraire la date de l'URL

  if (startDate) {
    const urls = generateUrls(baseUrl, startDate, 15, 15); // Générer les URLs
    fetchAllSportsResults(urls); // Lancer le scraping
  } else {
    console.error("Impossible d'extraire la date de l'URL dans .env.");
  }
});

// Route pour afficher la page HTML regroupant les données des fichiers .txt
app.get("/", (req, res) => {
  const dataFolderPath = path.join(__dirname, "data");
  const sportsFolders = fs
    .readdirSync(dataFolderPath)
    .filter((folder) =>
      fs.statSync(path.join(dataFolderPath, folder)).isDirectory()
    );

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
  `;

  sportsFolders.forEach((sport) => {
    const sportFolderPath = path.join(dataFolderPath, sport);
    const files = fs
      .readdirSync(sportFolderPath)
      .filter((file) => file.endsWith(".txt"));

    htmlContent += `<h2>${sport.toUpperCase()}</h2>`;

    files.forEach((file) => {
      const filePath = path.join(sportFolderPath, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const rows = fileContent.split("\n").filter((line) => line.trim() !== "");

      htmlContent += `
        <div class="file-section">
          <h3>${file}</h3>
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
        const matchRegex =
          /^(\d+)\.\s+(.+?)\s+\((\d*|N\/A)\)\s+vs\s+(.+?)\s+\((\d*|N\/A)\)\s*(Heure\s*:\s*(.+))?$/;
        const matchData = row.match(matchRegex);

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
    });
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
