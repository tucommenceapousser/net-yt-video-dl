const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const app = express();
const ytdl = require("ytdl-core");
const TOKEN = '6143548641:AAEHrr8QvRjwj9EaVHoxB5aDGytvVjOSBOY';
const bot = new TelegramBot(TOKEN, { polling: true });
const fs = require("fs");
// Afficher le formulaire de téléchargement sur la page d'accueil
app.set("view engine", "ejs");
app.get("/", (req, res) => {
	return res.render("index");
});
app.get("/download", async(req, res) => {
	const v_id = req.query.url.split('v=')[1];
    const info = await ytdl.getInfo(req.query.url);
    console.log(info.formats[4]);
    console.log(info.formats[1]);

	return res.render("download", {
		url: "https://www.youtube.com/embed/" + v_id,
        info: info.formats.sort((a, b) => {
            return a.mimeType < b.mimeType;
        }),
	});
});

// Effectuer le téléchargement de la vidéo et envoyer le fichier au chat Telegram
bot.onText(/\/youtube (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1];
    const v_id = url.split('v=')[1];
    const info = await ytdl.getInfo(url);
    const formats = info.formats.sort((a, b) => {
        return a.mimeType < b.mimeType;
    });

    // Envoyer le message de réponse pour demander le format souhaité
    bot.sendMessage(chatId, `Quel format voulez-vous pour ${info.title}?`, {
        reply_markup: {
            inline_keyboard: formats.slice(0, 5).map(format => ([{
                text: format.mimeType,
                callback_data: JSON.stringify({
                    url: url,
                    format: format.itag
                })
            }]))
        }
    });
});

// Gérer la sélection de format de fichier par l'utilisateur
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = JSON.parse(callbackQuery.data);
    const info = await ytdl.getInfo(data.url);
    const format = info.formats.find(f => f.itag === data.format);
    const videoReadableStream = ytdl.downloadFromInfo(info, {
        format: format
    });

    // Enregistrer la vidéo sur le disque
    const videoPath = `./${info.title}.mp4`;
    videoReadableStream.pipe(fs.createWriteStream(videoPath));

    // Attendre que la vidéo soit complètement enregistrée avant de l'envoyer sur Telegram
    videoReadableStream.on('end', () => {
        // Envoyer la vidéo au chat Telegram
        bot.sendVideo(chatId, videoPath, {
            caption: info.title,
            duration: info.length_seconds,
            thumb: info.thumbnail_url
        }, {
            reply_markup: {
                remove_keyboard: true
            }
        });
    });
});

// Lancer le serveur express
app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});
