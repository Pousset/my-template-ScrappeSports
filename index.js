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
    const url = "https://www.footmercato.net/live/europe/2025-03-25"; // URL du site à scraper
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extraire la date depuis l'URL
    const urlParts = url.split("/");
    const lastPart = urlParts[urlParts.length - 1];
    const dateFromUrl = lastPart.match(/^\d{4}-\d{2}-\d{2}$/) ? lastPart : null;

    // Utiliser la date extraite ou la date du jour
    const date = dateFromUrl || new Date().toISOString().split("T")[0];

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
        homeScorers,
        awayScorers,
      });
    });

    // Préparer les résultats pour l'écriture dans un fichier
    let output = `Matchs du ${date} :\n`;
    results.forEach((result, index) => {
      output += `${index + 1}. ${result.homeTeam} (${result.homeScore}) vs ${
        result.awayTeam
      } (${result.awayScore})\n`;
      output += `   Heure : ${result.time}\n`;
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
    fs.writeFileSync("resultats_FM.txt", output, "utf8");
    console.log("Les résultats ont été enregistrés dans FM.txt");
  } catch (error) {
    console.error("Erreur lors du scraping :", error);
  }
}

async function fetchFootballResultsFromLequipe() {
  try {
    const baseUrl = "https://www.lequipe.fr/Directs/20250324";
    const url = `${baseUrl}/Directs/`; // URL de la page principale des directs
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Trouver le lien vers la section "Football"
    const footballLink = $("a.Link.LiveListingWidget__title")
      .filter((_, element) => $(element).text().trim() === "Football")
      .attr("href");

    if (!footballLink) {
      console.log("Lien vers la section Football introuvable.");
      return;
    }

    // Construire l'URL complète pour la section Football
    const footballUrl = `${baseUrl}${footballLink}`;
    console.log(`Scraping des résultats de football depuis : ${footballUrl}`);

    // Charger la page des résultats de football
    const footballResponse = await axios.get(footballUrl);
    const footballPage = cheerio.load(footballResponse.data);

    const results = [];
    footballPage(".SportEventWidget--match").each((index, element) => {
      const homeTeam = footballPage(element)
        .find(".TeamScore__team--home .TeamScore__nameshort span")
        .text()
        .trim()
        .replace(/\s+/g, " "); // Supprimer les espaces multiples
      const awayTeam = footballPage(element)
        .find(".TeamScore__team--away .TeamScore__nameshort span")
        .text()
        .trim()
        .replace(/\s+/g, " "); // Supprimer les espaces multiples
      const homeScore = footballPage(element)
        .find(".TeamScore__score--home")
        .text()
        .trim();
      const awayScore = footballPage(element)
        .find(".TeamScore__score--away")
        .text()
        .trim();
      const time = footballPage(element)
        .find(".TeamScore__schedule span")
        .text()
        .trim();
      const homeRank = footballPage(element)
        .find(".TeamScore__team--home .TeamScore__rang")
        .text()
        .trim();
      const awayRank = footballPage(element)
        .find(".TeamScore__team--away .TeamScore__rang")
        .text()
        .trim();

      // Vérifier si les données sont valides
      if (!homeTeam || !awayTeam || !homeScore || !awayScore) {
        console.log(
          `Match ignoré en raison de données manquantes : ${homeTeam} vs ${awayTeam}`
        );
        return; // Ignorer ce match
      }

      results.push({
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        time,
        homeRank,
        awayRank,
      });
    });

    // Vérifier si des résultats ont été récupérés
    if (results.length === 0) {
      console.log("Aucun résultat trouvé pour les matchs de football.");
      return;
    }

    // Préparer les résultats pour l'écriture dans un fichier
    let output = `Résultats des matchs de football :\n`;
    results.forEach((result, index) => {
      output += `${index + 1}.\n`;
      output += `   Équipe Domicile :  (${result.homeScore})\n`;
      output += `   Équipe Extérieure :  (${result.awayScore})\n`;
      if (result.homeRank) {
        output += `   Classement actuel (domicile) : ${result.homeRank}\n`;
      }
      if (result.awayRank) {
        output += `   Classement actuel (extérieur) : ${result.awayRank}\n`;
      }
      output += `   Heure : ${result.time}\n\n`;
    });

    // Écrire les résultats dans un fichier texte spécifique
    fs.writeFileSync("resultats_football.txt", output.trim(), "utf8");
    console.log(
      "Les résultats de football ont été enregistrés dans resultats_football.txt"
    );
  } catch (error) {
    console.error("Erreur lors du scraping :", error);
  }
}

async function fetchAllSportsResults() {
  try {
    const baseUrl = "https://www.lequipe.fr";
    const url = `${baseUrl}/Directs/20250316`; // URL de la page principale des directs
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Trouver tous les liens des sports
    const sportsLinks = [];
    $("a.Link.LiveListingWidget__title").each((_, element) => {
      const sportName = $(element).text().trim();
      const sportLink = $(element).attr("href");
      if (sportName && sportLink) {
        sportsLinks.push({ name: sportName, url: `${baseUrl}${sportLink}` });
      }
    });

    if (sportsLinks.length === 0) {
      console.log("Aucun sport trouvé sur la page.");
      return;
    }

    // Scraper les données pour chaque sport
    for (const sport of sportsLinks) {
      console.log(`Scraping des résultats pour le sport : ${sport.name}`);
      const sportResponse = await axios.get(sport.url);
      const sportPage = cheerio.load(sportResponse.data);

      const results = [];
      sportPage(".SportEventWidget--match").each((_, element) => {
        const homeTeam = sportPage(element)
          .find(".TeamScore__team--home .TeamScore__nameshort span")
          .text()
          .trim();
        const awayTeam = sportPage(element)
          .find(".TeamScore__team--away .TeamScore__nameshort span")
          .text()
          .trim();
        const homeScore = sportPage(element)
          .find(".TeamScore__score--home")
          .text()
          .trim();
        const awayScore = sportPage(element)
          .find(".TeamScore__score--away")
          .text()
          .trim();
        const time = sportPage(element)
          .find(".TeamScore__schedule span")
          .text()
          .trim();

        results.push({
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          time,
        });
      });

      // Vérifier si des résultats ont été récupérés
      if (results.length === 0) {
        console.log(`Aucun résultat trouvé pour le sport : ${sport.name}`);
        continue;
      }

      // Préparer les résultats pour l'écriture dans un fichier
      let output = `Résultats des matchs de ${sport.name} :\n`;
      results.forEach((result, index) => {
        output += `${index + 1}. ${result.homeTeam} (${result.homeScore}) vs ${
          result.awayTeam
        } (${result.awayScore})\n`;
        output += `   Heure : ${result.time}\n\n`;
      });

      // Écrire les résultats dans un fichier texte spécifique
      const fileName = `resultats_${sport.name
        .toLowerCase()
        .replace(/ /g, "_")}.txt`;
      fs.writeFileSync(fileName, output, "utf8");
      console.log(
        `Les résultats de ${sport.name} ont été enregistrés dans ${fileName}`
      );
    }

    // Tous les fichiers ont été créés
    console.log("Tous les fichiers ont été créés.");
  } catch (error) {
    console.error("Erreur lors du scraping :", error);
  }
}

// Événement déclenché lorsque le bot est prêt
client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  fetchFootballResults(); // Appeler la fonction existante
  fetchFootballResultsFromLequipe(); // Appeler la nouvelle fonction
  fetchAllSportsResults(); // Appeler la fonction pour scraper tous les sports
});

// Gérer les interactions avec les commandes
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "resultats") {
    try {
      // Lire le contenu du fichier FootMercato.txt
      const results = fs.readFileSync("FootMercato.txt", "utf8");

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
      console.error("Erreur lors de la lecture du fichier :", error);
      await interaction.reply("Impossible de lire les résultats.");
    }
  }
});

// Connectez le bot
client.login(TOKEN).catch(console.error);
