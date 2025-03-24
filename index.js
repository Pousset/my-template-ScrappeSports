// filepath: c:\Users\mathi\Documents\GitHub\ScrappeDiscord_PYTHON\index.js
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");

// Créez une instance du client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Token de votre bot (remplacez par votre token)
const TOKEN =
  "MTM1MzQ5NzEzMzQ1NzczNTc2Mg.GzroxV.x1Yp_YgxznlL1mw7ha7rdJW_81f9HQO61DbtM0";

// Fonction pour scraper les résultats de foot
async function fetchFootballResults() {
  try {
    const response = await axios.get(
      "https://www.footmercato.net/live/europe/2025-03-23"
    );
    const $ = cheerio.load(response.data);

    const results = [];
    $(".matchesGroup__match").each((index, element) => {
      const homeTeam = $(element)
        .find(".matchFull__team:first-child .matchTeam__name")
        .text()
        .trim();
      const awayTeam = $(element)
        .find(".matchFull__team:last-child .matchTeam__name")
        .text()
        .trim();
      const homeScore = $(element)
        .find(
          ".matchFull__team:first-child .matchFull__score, .matchFull__team:first-child .matchFull__score--highlight"
        )
        .text()
        .trim();
      const awayScore = $(element)
        .find(
          ".matchFull__team:last-child .matchFull__score, .matchFull__team:last-child .matchFull__score--highlight"
        )
        .text()
        .trim();
      const time = $(element).find(".matchFull__infosDate time").text().trim();

      results.push({ homeTeam, awayTeam, homeScore, awayScore, time });
    });

    console.log("Résultats des matchs :");
    results.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.homeTeam} (${result.homeScore}) vs ${
          result.awayTeam
        } (${result.awayScore}) - Heure : ${result.time}`
      );
    });
  } catch (error) {
    console.error("Erreur lors du scraping :", error);
  }
}

// Événement déclenché lorsque le bot est prêt
client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  fetchFootballResults(); // Appeler la fonction de scraping
});

// Connectez le bot
client.login(TOKEN).catch(console.error);
