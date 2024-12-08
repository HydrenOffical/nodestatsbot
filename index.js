const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Discord Bot Initialization
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Load Commands from /commands Directory
const commandsDir = path.join(__dirname, 'commands');
const commands = [];
const nodeStatus = {}; // To track uptime and status of nodes

fs.readdirSync(commandsDir).forEach(file => {
  if (file.endsWith('.json')) {
    const filePath = path.join(commandsDir, file);
    const command = require(filePath);
    commands.push({ name: command.name, data: command.node });
    nodeStatus[command.name] = { isOnline: false, startTime: null, uptime: 0 };
  }
});

// Function to Check Node Status
async function checkNodeStatus(command) {
  try {
    const response = await axios.get(command.data.address, {
      auth: {
        username: 'Skyport',
        password: command.data.key
      }
    });

    const now = Date.now();
    const status = nodeStatus[command.name];

    if (!status.isOnline) {
      // Node just came online
      status.isOnline = true;
      status.startTime = now;
      status.uptime = 0;
    } else {
      // Node is already online, update uptime
      status.uptime = now - status.startTime;
    }

    return {
      isOnline: true,
      uptime: status.uptime,
      version: response.data.versionRelease || 'Unknown'
    };
  } catch (error) {
    // Node is offline, reset status
    const status = nodeStatus[command.name];
    status.isOnline = false;
    status.startTime = null;
    status.uptime = 0;

    return { isOnline: false };
  }
}

// Handle Commands
client.on('messageCreate', async message => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const commandName = message.content.slice(1); // Remove the `!` prefix
  const command = commands.find(cmd => cmd.name.toLowerCase() === commandName.toLowerCase());

  if (!command) {
    message.channel.send(`Command \`${commandName}\` not found.`);
    return;
  }

  const status = await checkNodeStatus(command);

  if (status.isOnline) {
    const embed = new EmbedBuilder()
      .setTitle(`${command.name} is Online`)
      .setColor('Green')
      .addFields(
        { name: 'Uptime', value: formatUptime(status.uptime), inline: true },
        { name: 'Version', value: status.version, inline: true }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  } else {
    const embed = new EmbedBuilder()
      .setTitle(`${command.name} is Offline`)
      .setColor('Red')
      .setDescription('Connection to the node failed.')
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

// Format Uptime
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Periodic Node Check
setInterval(async () => {
  for (const command of commands) {
    await checkNodeStatus(command);
  }
}, 1000);

// Bot Login
client.once('ready', () => {
  console.log('\x1b[36m%s\x1b[0m', '---------------------------------------');
  console.log('\x1b[32m%s\x1b[0m', ' Bot is now online and ready! ');
  console.log('\x1b[36m%s\x1b[0m', ` Logged in as: ${client.user.username} `);
  console.log('\x1b[36m%s\x1b[0m', '---------------------------------------');
});

// Bot Login
client.login(config.token);
