import { SlashCommandBuilder } from 'discord.js';

const cmd = {
  name: 'ping',
  description: 'Replies with Pong and latency',
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong and latency'),
  async executeSlash(interaction: any) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Pong! Latency: ${latency}ms. API: ${Math.round(interaction.client.ws.ping)}ms`);
  },
  async executePrefix(message: any) {
    const before = Date.now();
    const reply = await message.channel.send('Pinging...');
    const latency = Date.now() - before;
    await reply.edit(`Pong! Latency: ${latency}ms. API: ${Math.round(message.client.ws.ping)}ms`);
  }
};

export = cmd;
