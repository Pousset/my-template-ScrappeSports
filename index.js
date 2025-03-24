// filepath: c:\Users\mathi\Documents\GitHub\ScrappeDiscord_PYTHON\index.js
const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs"); // Importer le module fs

// Créez une instance du client Discord
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Token de votre bot (remplacez par votre token)
const TOKEN =
  "MTM1MzQ5NzEzMzQ1NzczNTc2Mg.GzroxV.x1Yp_YgxznlL1mw7ha7rdJW_81f9HQO61DbtM0";

// Fonction pour scraper les résultats de foot avec détails supplémentaires
async function fetchFootballResults() {
  try {
    const response = await axios.get(
      "https://www.footmercato.net/live/europe/2025-03-27"
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

    // Préparer les résultats pour l'écriture dans un fichier
    let output = "Résultats des matchs avec détails :\n";
    results.forEach((result, index) => {
      output += `${index + 1}. ${result.homeTeam} (${result.homeScore}) vs ${
        result.awayTeam
      } (${result.awayScore})\n`;
      output += `   Heure : ${result.time}\n`;
      output += `   Drapeaux : ${result.homeFlag} vs ${result.awayFlag}\n`;
      output += `   Lien du match : ${result.matchLink}\n`;
      output += "   Buteurs équipe domicile :\n";
      result.homeScorers.forEach(
        (scorer) => (output += `     - ${scorer.time} : ${scorer.name}\n`)
      );
      output += "   Buteurs équipe extérieure :\n";
      result.awayScorers.forEach(
        (scorer) => (output += `     - ${scorer.time} : ${scorer.name}\n`)
      );
      output += "\n";
    });

    // Écrire les résultats dans un fichier texte
    fs.writeFileSync("resultats.txt", output, "utf8");
    console.log("Les résultats ont été enregistrés dans resultats.txt");
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
