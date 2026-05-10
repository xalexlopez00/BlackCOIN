require('dotenv').config();
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'bot.log');
const old = console.log, err = console.error;
console.log = (...a) => { old(...a); fs.appendFileSync(logFile, a.join(' ') + '\n'); };
console.error = (...a) => { err(...a); fs.appendFileSync(logFile, '[ERROR] ' + a.join(' ') + '\n'); };

console.log('Iniciando bot...');
require('./index.js');
