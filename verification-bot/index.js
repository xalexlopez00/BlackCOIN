require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, ChannelType, EmbedBuilder, Colors,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const CONFIG = {
  logVerify: process.env.VERIFY_LOG_CHANNEL_ID,
  logTicket: process.env.TICKET_LOG_CHANNEL_ID || process.env.VERIFY_LOG_CHANNEL_ID,
  logSuggest: process.env.SUGGEST_LOG_CHANNEL_ID || process.env.VERIFY_LOG_CHANNEL_ID,
  transcriptChannel: process.env.TRANSCRIPT_CHANNEL_ID,
  ticketCategory: process.env.TICKET_CATEGORY_ID,
  recoveryCategory: process.env.RECOVERY_CATEGORY_ID,
  reportCategory: process.env.REPORT_CATEGORY_ID,
  appealCategory: process.env.APPEAL_CATEGORY_ID,
  suggestionsChannel: process.env.SUGGESTIONS_CHANNEL_ID,
  staffRole: process.env.STAFF_ROLE_ID,
  commandsChannel: process.env.COMMANDS_CHANNEL_ID,
  welcomeChannel: process.env.WELCOME_CHANNEL_ID,
};

async function sendToChannel(channelId, content) {
  const ch = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
  if (ch) return ch.send(content);
}

client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  console.log('Autorole activado: Unverified al entrar, Verified al verificar');
});

// AUTOROLE: al entrar, asigna "Unverified" + DM + mensaje
client.on('guildMemberAdd', async (member) => {
  try {
    const unverifiedRole = member.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
    if (unverifiedRole) {
      await member.roles.add(unverifiedRole);
    }
    const chCmds = member.guild.channels.cache.get(CONFIG.commandsChannel);
    // Welcome DM
    try {
      await member.send(`👋 **Bienvenido a BlackCOIN ${member.user.username}!**\n\nPara acceder a todos los canales, ve a ${chCmds || 'el servidor'} y usa \`/verify\` para verificar tu identidad.\n\nSi necesitas ayuda, usa \`/ticket\` para abrir un ticket de soporte.`);
    } catch {}
    // Welcome channel message
    const welcomeCh = member.guild.channels.cache.get(CONFIG.welcomeChannel);
    if (welcomeCh) {
      welcomeCh.send(`👋 ¡Bienvenido ${member}! Usa \`/verify\` en ${chCmds || '#comandos'} para verificar tu identidad y acceder a todos los canales.`).catch(() => {});
    }
    console.log(`[AUTOROLE] ${member.user.tag} -> Unverified`);
  } catch (err) {
    console.error('[AUTOROLE] Error:', err.message);
  }
});

const cooldowns = new Map();

// Solo permitir comandos en #comandos o en tickets (close, add)
function isAllowedChannel(interaction) {
  if (interaction.channelId === CONFIG.commandsChannel) return true;
  if (['close', 'add'].includes(interaction.commandName) && interaction.channel?.topic?.startsWith('ticket-')) return true;
  return false;
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return handleButtons(interaction);

  // === SEGURIDAD ===
  // 1. Solo en canales permitidos
  if (!isAllowedChannel(interaction)) {
    return interaction.reply({
      content: `❌ Los comandos solo se pueden usar en <#${CONFIG.commandsChannel}>`,
      ephemeral: true,
    });
  }
  // 2. Cooldown por usuario (3s)
  const cooldown = cooldowns.get(interaction.user.id);
  if (cooldown && Date.now() - cooldown < 3000) {
    return interaction.reply({
      content: '⏳ Espera 3 segundos entre comandos.',
      ephemeral: true,
    });
  }
  cooldowns.set(interaction.user.id, Date.now());

  // 3. Auto-delete command message in #comandos after 3s
  if (interaction.channelId === CONFIG.commandsChannel) {
    try { setTimeout(() => interaction.channel?.bulkDelete(1).catch(() => {}), 3000); } catch {}
  }

  try {
    switch (interaction.commandName) {
      case 'verify': return handleVerify(interaction);
      case 'ticket': return handleTicket(interaction);
      case 'close': return handleClose(interaction);
      case 'add': return handleAdd(interaction);
      case 'suggest': return handleSuggest(interaction);
    }
  } catch (err) {
    console.error('Error en comando:', err);
    const reply = interaction.replied || interaction.deferred ? interaction.followUp.bind(interaction) : interaction.reply.bind(interaction);
    await reply({ content: 'Ocurrió un error.', ephemeral: true }).catch(() => {});
  }
});

// Manejador de botones separado
async function handleButtons(interaction) {
  try {
    switch (interaction.customId) {
      case 'close_ticket': return handleCloseTicket(interaction);
      case 'delete_ticket':
      case 'cancel_delete': return handleDeleteTicket(interaction);
      case 'verify_yes':
      case 'verify_no': return handleVerifyResponse(interaction);
      case 'suggest_upvote': return handleSuggestVote(interaction, 1);
      case 'suggest_downvote': return handleSuggestVote(interaction, -1);
    }
  } catch (err) {
    console.error('Error en boton:', err);
    const reply = interaction.replied || interaction.deferred
      ? interaction.followUp.bind(interaction)
      : interaction.reply.bind(interaction);
    await reply({ content: 'Ocurrió un error.', ephemeral: true }).catch(() => {});
  }
}

// ──────────────────────── VERIFY ────────────────────────

async function handleVerify(interaction) {
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_yes').setLabel('Sí, soy yo').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('verify_no').setLabel('No, no soy yo').setStyle(ButtonStyle.Danger),
    );

    await interaction.user.send({
      content: `🔐 **Verificación de identidad**\n\nHola **${interaction.user.username}**, se ha solicitado una verificación de tu cuenta.\n\n¿Eres tú quien está intentando autenticarse?`,
      components: [row],
    });

    await interaction.reply({
      content: 'Te he enviado un mensaje privado para verificar tu identidad. Revisa tus DMs.',
      ephemeral: true,
    });
  } catch {
    await interaction.reply({
      content: 'No pude enviarte un DM. Asegúrate de tener los DMs abiertos.',
      ephemeral: true,
    });
  }
}

async function handleVerifyResponse(interaction) {
  const confirmed = interaction.customId === 'verify_yes';

  await interaction.update({
    content: confirmed
      ? '**Identidad verificada correctamente.** Has confirmado que eres tú.'
      : '**Verificación cancelada.** Has indicado que NO eres tú.',
    components: [],
  });

  // AUTOROLE: cambiar Unverified -> Verified si confirma
  if (confirmed) {
    try {
      const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      if (member) {
        const unverifiedRole = interaction.guild.roles.cache.get(process.env.UNVERIFIED_ROLE_ID);
        const verifiedRole = interaction.guild.roles.cache.get(process.env.VERIFIED_ROLE_ID);
        if (unverifiedRole) await member.roles.remove(unverifiedRole).catch(() => {});
        if (verifiedRole) await member.roles.add(verifiedRole).catch(() => {});
        console.log(`[AUTOROLE] ${interaction.user.tag}: Unverified -> Verified`);
      }
      // Welcome DM after verification
      try {
        await interaction.user.send(`✅ **¡Verificacion exitosa!** Ya tienes acceso a todos los canales de **BlackCOIN**.\n\n💬 Chatea en <#${CONFIG.welcomeChannel || 'el servidor'}>\n🎫 ¿Necesitas ayuda? Usa \`/ticket\`\n💡 ¿Tienes ideas? Usa \`/suggest\``);
      } catch {}
    } catch (err) {
      console.error('[AUTOROLE] Error en verify:', err.message);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(confirmed ? Colors.Green : Colors.Red)
    .setTitle(`Verificación ${confirmed ? 'Exitosa' : 'Rechazada'}`)
    .addFields(
      { name: 'Usuario', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
      { name: 'Resultado', value: confirmed ? 'Aceptó' : 'Rechazó', inline: true },
    )
    .setTimestamp();

  sendToChannel(CONFIG.logVerify, { embeds: [embed] });
}

// ──────────────────────── TICKET TYPES ────────────────────────

const TICKET_TYPES = {
  soporte: { category: 'ticketCategory', label: 'Soporte General', prefix: 'soporte' },
  recuperacion: { category: 'recoveryCategory', label: 'Recuperación de Cuenta', prefix: 'recuperacion' },
  reporte: { category: 'reportCategory', label: 'Reporte', prefix: 'reporte' },
  apelacion: { category: 'appealCategory', label: 'Apelación', prefix: 'apelacion' },
};

// ──────────────────────── /TICKET ────────────────────────

async function handleTicket(interaction) {
  const type = interaction.options.getString('tipo');
  const user = interaction.user;
  const config = TICKET_TYPES[type];
  if (!config) return;

  const existing = interaction.guild.channels.cache.find(
    (ch) => ch.topic === `ticket-${user.id}` && ch.type === ChannelType.GuildText,
  );
  if (existing) {
    return interaction.reply({ content: `Ya tienes un ticket abierto: ${existing}`, ephemeral: true });
  }

  const categoryId = CONFIG[config.category];
  const category = interaction.guild.channels.cache.get(categoryId);
  if (!category) {
    return interaction.reply({ content: 'Esta categoría de ticket no está configurada. Contacta al staff.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const channel = await interaction.guild.channels.create({
    name: `${config.prefix}-${user.username.toLowerCase().replace(/\s+/g, '-')}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `ticket-${user.id}`,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: CONFIG.staffRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ],
  });

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger),
  );

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`Ticket de ${user.username}`)
    .setDescription(`**Tipo:** ${config.label}\n**Usuario:** <@${user.id}>\n\nDescribe tu problema y el staff te atenderá lo antes posible.`)
    .setTimestamp();

  await channel.send({ content: `<@${user.id}> <@&${CONFIG.staffRole}>`, embeds: [embed], components: [closeRow] });

  await interaction.editReply({ content: `Ticket creado: ${channel}` });

  const logEmbed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle('Ticket Abierto')
    .addFields(
      { name: 'Usuario', value: `${user.tag} (<@${user.id}>)`, inline: true },
      { name: 'Tipo', value: config.label, inline: true },
      { name: 'Canal', value: `${channel}`, inline: true },
    )
    .setTimestamp();

  sendToChannel(CONFIG.logTicket, { embeds: [logEmbed] });
}

// ──────────────────────── CLOSE TICKET ────────────────────────

async function handleCloseTicket(interaction) {
  if (!interaction.member.roles.cache.has(CONFIG.staffRole)) {
    return interaction.reply({ content: 'Solo el staff puede cerrar tickets.', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('delete_ticket').setLabel('Confirmar cierre').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ content: 'Confirma que quieres cerrar este ticket:', components: [row], ephemeral: true });
}

async function handleDeleteTicket(interaction) {
  if (interaction.customId === 'cancel_delete') {
    return interaction.update({ content: 'Cierre cancelado.', components: [], ephemeral: true });
  }

  const channel = interaction.channel;
  const userId = channel.topic?.replace('ticket-', '');
  const user = userId ? await client.users.fetch(userId).catch(() => null) : null;

  await interaction.update({ content: 'Guardando transcripción...', components: [] });

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();

    const lines = sorted.map((m) => {
      const time = m.createdAt.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      const name = m.author?.tag || 'Desconocido';
      const content = m.content || '(sin texto)';
      return `[${time}] ${name}: ${content}`;
    });

    const transcriptText = [
      `=== TRANSCRIPCIÓN DE TICKET ===`,
      `Canal: ${channel.name}`,
      `Usuario: ${user?.tag || 'Desconocido'} (${userId || '?'})`,
      `Cerrado por: ${interaction.user.tag}`,
      `Fecha: ${new Date().toLocaleString('es-ES')}`,
      `Total mensajes: ${lines.length}`,
      '',
      ...lines,
      '',
      '=== FIN DE LA TRANSCRIPCIÓN ===',
    ].join('\n');

    const transcriptEmbed = new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle('Ticket Cerrado')
      .addFields(
        { name: 'Canal', value: channel.name, inline: true },
        { name: 'Usuario', value: user ? `${user.tag} (<@${userId}>)` : 'Desconocido', inline: true },
        { name: 'Cerrado por', value: interaction.user.tag, inline: true },
        { name: 'Mensajes', value: `${lines.length}`, inline: true },
        { name: 'Tipo', value: channel.name.split('-')[0] || 'N/A', inline: true },
      )
      .setTimestamp();

    const buffer = Buffer.from(transcriptText, 'utf-8');

    await sendToChannel(CONFIG.transcriptChannel, {
      embeds: [transcriptEmbed],
      files: [{ attachment: buffer, name: `transcripcion-${channel.name}.txt` }],
    });
  } catch (err) {
    console.error('Error al guardar transcripción:', err);
  }

  const logEmbed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('Ticket Cerrado')
    .addFields(
      { name: 'Usuario', value: user ? `${user.tag} (<@${userId}>)` : 'Desconocido', inline: true },
      { name: 'Cerrado por', value: interaction.user.tag, inline: true },
      { name: 'Canal', value: channel.name, inline: true },
    )
    .setTimestamp();

  sendToChannel(CONFIG.logTicket, { embeds: [logEmbed] });

  if (user) {
    await user.send('Tu ticket ha sido cerrado. Puedes abrir uno nuevo si lo necesitas.').catch(() => {});
  }

  await channel.delete();
}

// ──────────────────────── /CLOSE ────────────────────────

async function handleClose(interaction) {
  if (!interaction.member.roles.cache.has(CONFIG.staffRole)) {
    return interaction.reply({ content: 'No tienes permisos.', ephemeral: true });
  }

  if (!interaction.channel.topic?.startsWith('ticket-')) {
    return interaction.reply({ content: 'Este no es un canal de ticket.', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('delete_ticket').setLabel('Confirmar cierre').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ content: 'Confirma que quieres cerrar este ticket:', components: [row], ephemeral: true });
}

// ──────────────────────── /ADD ────────────────────────

async function handleAdd(interaction) {
  if (!interaction.member.roles.cache.has(CONFIG.staffRole)) {
    return interaction.reply({ content: 'No tienes permisos.', ephemeral: true });
  }

  if (!interaction.channel.topic?.startsWith('ticket-')) {
    return interaction.reply({ content: 'Este no es un canal de ticket.', ephemeral: true });
  }

  const target = interaction.options.getUser('usuario');
  await interaction.channel.permissionOverwrites.create(target.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  });

  await interaction.reply({ content: `${target} ha sido añadido al ticket.` });
}

// ──────────────────────── /SUGGEST ────────────────────────

async function handleSuggest(interaction) {
  const text = interaction.options.getString('texto');
  if (!text || text.length > 1000) {
    return interaction.reply({ content: 'El texto debe tener entre 1 y 1000 caracteres.', ephemeral: true });
  }

  const channel = client.channels.cache.get(CONFIG.suggestionsChannel);
  if (!channel) {
    return interaction.reply({ content: 'El canal de sugerencias no está configurado.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
    .setTitle('Nueva sugerencia')
    .setDescription(text)
    .addFields({ name: 'Estado', value: 'Pendiente de revisión' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('suggest_upvote').setLabel('A favor').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('suggest_downvote').setLabel('En contra').setStyle(ButtonStyle.Danger),
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `Sugerencia enviada: ${msg.url}`, ephemeral: true });

  const logEmbed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle('Nueva Sugerencia')
    .addFields(
      { name: 'Usuario', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
      { name: 'Sugerencia', value: text.slice(0, 500), inline: false },
    )
    .setTimestamp();

  sendToChannel(CONFIG.logSuggest, { embeds: [logEmbed] });
}

async function handleSuggestVote(interaction, direction) {
  const field = interaction.message.embeds[0]?.fields?.[0];
  if (!field) return;

  const match = field.value.match(/(\d+) a favor, (\d+) en contra/);
  let up = match ? parseInt(match[1]) : 0;
  let down = match ? parseInt(match[2]) : 0;

  if (direction === 1) up++;
  if (direction === -1) down++;

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .spliceFields(0, 1, { name: 'Estado', value: `${up} a favor, ${down} en contra` });

  await interaction.update({ embeds: [embed] });
  await interaction.followUp({ content: 'Voto registrado.', ephemeral: true });
}

// ──────────────────────── LOGIN ────────────────────────

client.login(process.env.DISCORD_TOKEN);
