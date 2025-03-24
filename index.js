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
    console.log("Commandes bot OK !");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes :", error);
  }
})();

// Fonction pour scraper les résultats de foot avec détails supplémentaires
async function fetchFootballResults() {
  try {
    const response = await axios.get(
      "https://www.footmercato.net/live/europe/2025-03-18"
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
      // const homeFlag = $(element)
      //   .find(".matchFull__team:first-child .matchTeam__logo")
      //   .attr("data-src");
      // const awayFlag = $(element)
      //   .find(".matchFull__team:last-child .matchTeam__logo")
      //   .attr("data-src");
      // const matchLink = $(element).find(".matchFull__link").attr("href");

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
        // homeFlag,
        // awayFlag,
        // matchLink,
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
      // output += `   Drapeaux : ${result.homeFlag} vs ${result.awayFlag}\n`;
      // output += `   Lien du match : ${result.matchLink}\n`;
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

// Gérer les interactions avec les commandes
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "resultats") {
    try {
      // Lire le contenu du fichier resultats.txt
      const results = fs.readFileSync("resultats.txt", "utf8");

      // Envoyer les résultats dans le channel
      await interaction.reply(`Voici les résultats :\n\`\`\`${results}\`\`\``);
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier :", error);
      await interaction.reply("Impossible de lire les résultats.");
    }
  }
});

// Connectez le bot
client.login(TOKEN).catch(console.error);
