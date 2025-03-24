// filepath: c:\Users\mathi\Documents\GitHub\ScrappeDiscord_PYTHON\index.js
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");

// Créez une instance du client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Token de votre bot (remplacez par votre token)
const TOKEN =
  "MTM1MzQ5NzEzMzQ1NzczNTc2Mg.GzroxV.x1Yp_YgxznlL1mw7ha7rdJW_81f9HQO61DbtM0";

// Fonction pour scraper les résultats de foot avec détails supplémentaires
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
        .find(".matchFull__team:first-child .matchFull__score")
        .text()
        .trim();
      const awayScore = $(element)
        .find(".matchFull__team:last-child .matchFull__score")
        .text()
        .trim();
      const time = $(element).find(".matchFull__infosDate time").text().trim();
      const homeFlag = $(element)
        .find(".matchFull__team:first-child .matchTeam__logo")
        .attr("data-src");
      const awayFlag = $(element)
        .find(".matchFull__team:last-child .matchTeam__logo")
        .attr("data-src");
      const matchLink = $(element).find(".matchFull__link").attr("href");

      const homeScorers = [];
      $(element)
        .find(".matchFull__strikers--home .matchFull__striker")
        .each((_, scorer) => {
          const time = $(scorer).find(".matchFull__strikerTime").text().trim();
          const name = $(scorer).find(".matchFull__strikerName").text().trim();
          homeScorers.push({ time, name });
        });

      const awayScorers = [];
      $(element)
        .find(".matchFull__strikers--away .matchFull__striker")
        .each((_, scorer) => {
          const time = $(scorer).find(".matchFull__strikerTime").text().trim();
          const name = $(scorer).find(".matchFull__strikerName").text().trim();
          awayScorers.push({ time, name });
        });

      results.push({
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        time,
        homeFlag,
        awayFlag,
        matchLink,
        homeScorers,
        awayScorers,
      });
    });

    console.log("Résultats des matchs avec détails :");
    results.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.homeTeam} (${result.homeScore}) vs ${
          result.awayTeam
        } (${result.awayScore})`
      );
      console.log(`   Heure : ${result.time}`);
      console.log(`   Drapeaux : ${result.homeFlag} vs ${result.awayFlag}`);
      console.log(`   Lien du match : ${result.matchLink}`);
      console.log("   Buteurs équipe domicile :");
      result.homeScorers.forEach((scorer) =>
        console.log(`     - ${scorer.time} : ${scorer.name}`)
      );
      console.log("   Buteurs équipe extérieure :");
      result.awayScorers.forEach((scorer) =>
        console.log(`     - ${scorer.time} : ${scorer.name}`)
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
