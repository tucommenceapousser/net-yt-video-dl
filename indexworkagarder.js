const TelegramBot = require('node-telegram-bot-api');
const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const app = express();
const ytdl = require("ytdl-core");
const TOKEN = process.env['TOKEN'];
const bot = new TelegramBot(TOKEN, { polling: true });
const server = http.createServer(app);
const io = require('socket.io')(server);
const axios = require('axios');

const messages = [];

io.on('connection', (socket) => {
  console.log('User connected');

  const botMessages = messages
    .slice(-5)
    .map(m => m.text)
    .reverse();
  socket.emit('messages', botMessages);
});

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/messages", function(req, res) {
  const senderId = parseInt(req.query.from);
  const userMessages = messages
    .filter(m => m.sender === senderId)
    .slice(-5)
    .map(m => {
      const senderName = userNames[m.sender] || `Utilisateur ${m.sender}`;
      const time = new Date(m.timestamp).toLocaleTimeString();
      return {
        sender: m.sender,
        senderName: senderName,
        text: m.text,
        time: time
      };
    })
    .reverse();
  res.render("home", { messages: userMessages });
});


app.get('/', (req, res) => {
  res.render('index'); // Rendre le template index.ejs
});

app.get("/home", function(req, res) {
  const allMessages = messages
    .slice(-5)
    .map(m => m.text)
    .reverse();
  res.render("home", { messages: allMessages });
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

bot.onText(/\/youtube (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];
  const v_id = url.split('v=')[1];
  try {
    const info = await ytdl.getInfo(url);
    const formats = info.formats.sort((a, b) => {
      return a.mimeType < b.mimeType;
    });
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
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Une erreur est survenue lors du traitement de la commande.");
  }
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Bienvenue ! Utilisez /help pour voir la liste des commandes disponibles :\n" +
        "ce bot est la propriete de TRHACKNON\n");
});

// Afficher une liste de commandes disponibles pour l'utilisateur
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Voici la liste des commandes disponibles :\n" +
        "/help - affiche la liste des commandes\n" +
        "/fetch - affiche les cinq derniers messages envoyés par l'utilisateur\n" +
        "/pic - envoie une photo\n" +
        "/video - envoie une vidéo\n" +
        "/audio - envoie un fichier audio\n" +
        "/who - affiche un message personnalisé" +
        "/youtube - download youtube video exemple : https://m.youtube.com/watch?v=ydQoelT6AhM");
});

// Afficher les cinq derniers messages envoyés par l'utilisateur


// Handle incoming messages
// Handle incoming messages
// Handle incoming messages from the bot
bot.on('message', (msg) => {
  // Store the message in the messages array
  messages.push({
    text: msg.text,
    sender: msg.from.id,
    timestamp: msg.date
  });

  // Keep only the last 100 messages
  if (messages.length > 100) {
    messages.splice(0, messages.length - 100);
  }

  // Emit the new message to all clients via a socket
  io.emit('botMessage', {
    text: msg.text,
    sender: msg.from.id,
    timestamp: msg.date
  });

// Send the message content to the server
const messageContent = msg.text;
if (messageContent) {
  const requestOptions = {
    headers: { 'Content-Type': 'application/json' },
  };
  axios.post('http://localhost:3000/messages', { messageContent }, requestOptions)
    .then(response => {
      const contentType = response.headers['content-type'];
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.data;
      } else {
        return response.text();
      }
    })
    .catch(error => console.log(error));
}

});

// Define a new route to handle incoming messages
app.post('/messages', (req, res) => {
  const messageContent = req.body.messageContent;
  console.log(`Message received: ${messageContent}`);
  res.json({ status: 'OK' }); // Send a JSON response
});




// Handle the /fetch command
bot.onText(/\/fetch/, (msg) => {
  const chatId = msg.chat.id;
  const userMessages = messages
    .filter(m => m.sender === msg.from.id)
    .slice(-5)
    .map(m => m.text)
    .reverse();

  bot.sendMessage(chatId, "Here are your last five messages:\n" + userMessages.join("\n"));
});


// Envoyer une photo
bot.onText(/\/pic/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendPhoto(chatId, './uk.jpg');
});

// Envoyer une vidéo
bot.onText(/\/video/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendVideo(chatId, './uk.mp4');
});

// Envoyer un fichier audio
bot.onText(/\/audio/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendAudio(chatId, './uk.mp3');
});

// Afficher un message personnalisé
bot.onText(/\/who/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "im trhacknon anonymous hacker rainbow hat");
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