require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
  {
    name: 'verify',
    description: 'Inicia la verificación de identidad via DM',
  },
  {
    name: 'ticket',
    description: 'Abre un ticket de soporte',
    options: [
      {
        name: 'tipo',
        description: 'Tipo de ticket',
        type: 3,
        required: true,
        choices: [
          { name: 'Soporte General', value: 'soporte' },
          { name: 'Recuperación de Cuenta', value: 'recuperacion' },
          { name: 'Reportar Usuario', value: 'reporte' },
          { name: 'Apelación', value: 'apelacion' },
        ],
      },
    ],
  },
  {
    name: 'close',
    description: '[STAFF] Cierra este ticket',
  },
  {
    name: 'add',
    description: '[STAFF] Añade un usuario a este ticket',
    options: [
      {
        name: 'usuario',
        description: 'Usuario a añadir',
        type: 6,
        required: true,
      },
    ],
  },
  {
    name: 'suggest',
    description: 'Envía una sugerencia para el servidor',
    options: [
      {
        name: 'texto',
        description: 'Tu sugerencia',
        type: 3,
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando comandos slash...');
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('Comandos registrados en el servidor.');
  } catch (err) {
    console.error('Error al registrar comandos:', err);
  }
})();
