# BlackCOIN

Una criptomoneda profesional implementada en TypeScript con blockchain, PoW, red P2P, sistema multi-wallet, panel de administración y sistema de tickets de soporte.

---

## Características

| Característica | Descripción |
|---|---|
| **Blockchain** | Modelo UTXO completo, minería PoW, ajuste de dificultad, validación de cadena |
| **Wallets** | Multi-wallet con claves encriptadas AES-256, protegidas por contraseña |
| **Transacciones** | Firmas ECDSA secp256k1, prevención de doble gasto, halving de recompensa |
| **CNS Names** | Sistema de Nombres Crypto - envía a `alice.pro` en vez de direcciones largas |
| **Red P2P** | WebSockets, descubrimiento de pares, auto-sincronización, límite de conexiones |
| **API REST** | CRUD completo para bloques, transacciones, wallets, mempool, richlist, CNS |
| **Web Wallet GUI** | Dashboard visual en `http://localhost:3001` |
| **Descubrimiento LAN** | Auto-descubre nodos en LAN, RadminVPN, Hamachi mediante UDP broadcast |
| **Sistema de Usuarios** | Registro, login, roles (admin/user), sesiones con token |
| **Panel Admin** | Gestionar usuarios (promover/degradar admins, resetear passwords, eliminar) |
| **Terminal Web** | Terminal interactiva en el navegador para admins — comandos integrados + shell |
| **Soporte Técnico** | Sistema de tickets con chat, respuestas de admin, apertura/cierre/reapertura |
| **CLI** | Terminal interactiva con gestión de wallets, minería, envíos, nombres, admin, soporte |
| **Launcher** | Script `start-all.ps1` / `start-all.bat` que instala dependencias, compila e inicia nodo + Discord bot |
| **Halving** | La recompensa de coinbase se reduce a la mitad cada cierto número de bloques |
| **Docker** | Soporte para clúster multi-nodo con docker-compose |
| **VPS Ready** | Servicio systemd, configuración PM2, healthcheck |

---

## Requisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

## Inicio Rápido (Todo el proyecto)

El proyecto incluye un **launcher automático** que instala dependencias, compila e inicia tanto el nodo BlackCOIN como el Discord Verification Bot:

```powershell
# Windows: doble-click o terminal
.\start-all.bat

# O directamente con PowerShell
.\start-all.ps1
```

Esto arranca:
- **BlackCOIN Node** → `http://localhost:3001`
- **Discord Verification Bot** → conectado a Discord
- **Terminal interactiva** → `.\terminal.ps1`

### Instalación Manual (solo nodo)

```bash
git clone <repo-url> blackcoin
cd blackcoin
npm install
npm run compile
npm start
```

El nodo al iniciar:
1. Crea el bloque génesis en la primera ejecución
2. Inicia la API HTTP en el puerto 3001
3. Inicia el servidor P2P en el puerto 6001
4. Inicia la CLI interactiva

---

## CLI - Comandos

### Generales
| Comando | Descripción |
|---|---|
| `help` | Muestra todos los comandos |
| `info` | Estado del nodo: bloques, pares, wallets |
| `blockchain` | Resumen completo de la cadena |
| `blocks` | Últimos 20 bloques |
| `block <hash\|indice>` | Detalles de un bloque |
| `balance <direccion>` | Saldo de una dirección |
| `utxos` | Todos los UTXOs no gastados |
| `pool` | Transacciones pendientes en el mempool |

### Wallets
| Comando | Descripción |
|---|---|
| `wallets` | Listar wallets con saldos |
| `wallet:create <nombre>` | Crear wallet (pide contraseña) |
| `wallet:show <id\|dir>` | Detalles de wallet |
| `wallet:export <id>` | Exportar clave privada (pide contraseña) |
| `wallet:import <hex> <nombre>` | Importar clave privada (pide contraseña) |
| `send <to> <monto> <fromId>` | Enviar monedas (pide contraseña, soporta nombre.pro) |
| `mine <direccion>` | Minar un bloque |

### CNS (Crypto Name System)
| Comando | Descripción |
|---|---|
| `name:register <nombre> <dir>` | Registrar nombre (ej. alice.pro) |
| `name:resolve <nombre>` | Resolver nombre a dirección |
| `name:lookup <direccion>` | Buscar nombre por dirección |
| `names` | Listar todos los nombres CNS |

### Red
| Comando | Descripción |
|---|---|
| `peers` | Mostrar pares conectados |
| `peer:connect <url>` | Conectar a un par (ws://host:port) |

### Autenticación
| Comando | Descripción |
|---|---|
| `register <user> <pass>` | Registrar nuevo usuario |
| `register:admin <user> <pass>` | Registrarse como admin (pide código) |
| `login <user> <pass>` | Iniciar sesión |
| `logout` | Cerrar sesión |
| `me` | Mostrar información del usuario actual |

### Soporte Técnico
| Comando | Descripción |
|---|---|
| `ticket:create <asunto> <msg>` | Crear ticket de soporte |
| `ticket:list` | Listar tus tickets |
| `ticket:show <id>` | Ver detalle del ticket |
| `ticket:reopen <id>` | Reabrir un ticket cerrado |

### Administración (requiere ser admin)
| Comando | Descripción |
|---|---|
| `admin:users` | Listar todos los usuarios |
| `admin:add <username>` | Promover usuario a admin |
| `admin:remove <username>` | Degradar admin |
| `admin:tickets` | Ver todos los tickets de soporte |
| `admin:reply <id> <msg>` | Responder ticket (lo cierra automáticamente) |
| `admin:terminal <cmd>` | Ejecutar comando en la terminal del servidor (web o CLI) |

---

## API REST Completa

### Autenticación

```bash
# Registrar (el primer usuario es admin automáticamente)
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secreta"}'

# Registrar como admin con código especial
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin2","password":"secreta","adminCode":"BLACKADMIN2024"}'

# Iniciar sesión
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secreta"}'

# Ver info del usuario actual
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

### Administración

```bash
# Listar usuarios (admin only)
curl http://localhost:3001/api/v1/admin/users \
  -H "Authorization: Bearer <token_admin>"

# Promover a admin
curl -X POST http://localhost:3001/api/v1/admin/promote \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1"}'

# Degradar admin
curl -X POST http://localhost:3001/api/v1/admin/demote \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1"}'

# Resetear contraseña (admin only)
curl -X POST http://localhost:3001/api/v1/admin/reset-password \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","newPassword":"nueva1234"}'

# Eliminar usuario (admin only)
curl -X DELETE http://localhost:3001/api/v1/admin/users/user1 \
  -H "Authorization: Bearer <token_admin>"
```

### Soporte Técnico

```bash
# Crear ticket (autenticado)
curl -X POST http://localhost:3001/api/v1/support/ticket \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"subject":"No puedo minar","message":"El minero no genera bloques"}'

# Listar tickets (tuyos o todos si eres admin)
curl http://localhost:3001/api/v1/support/tickets \
  -H "Authorization: Bearer <token>"

# Ver ticket individual
curl http://localhost:3001/api/v1/support/tickets/<ticket_id> \
  -H "Authorization: Bearer <token>"

# Responder ticket (admin only, cierra por defecto)
curl -X POST http://localhost:3001/api/v1/support/tickets/<id>/reply \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"reply":"Solución: ...","closeAfterReply":true}'

# Cerrar ticket (admin only)
curl -X POST http://localhost:3001/api/v1/support/tickets/<id>/close \
  -H "Authorization: Bearer <token_admin>"

# Reabrir ticket (dueño o admin)
curl -X POST http://localhost:3001/api/v1/support/tickets/<id>/reopen \
  -H "Authorization: Bearer <token>"

# Eliminar ticket (admin only)
curl -X DELETE http://localhost:3001/api/v1/support/tickets/<id> \
  -H "Authorization: Bearer <token_admin>"

# Terminal (admin only) - ejecutar comandos
curl -X POST http://localhost:3001/api/v1/admin/terminal \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}'
```

### Blockchain y Transacciones

```bash
# Info del nodo
curl http://localhost:3001/api/v1/info

# Healthcheck
curl http://localhost:3001/healthz

# Bloques
curl http://localhost:3001/api/v1/blocks
curl http://localhost:3001/api/v1/blocks/latest
curl http://localhost:3001/api/v1/blocks/all
curl http://localhost:3001/api/v1/blocks/hash/<hash>
curl http://localhost:3001/api/v1/blocks/index/<indice>

# Transacciones
curl http://localhost:3001/api/v1/transactions/<txid>

# Enviar transacción
curl -X POST http://localhost:3001/api/v1/transactions/send \
  -H "Content-Type: application/json" \
  -d '{"to":"P<direccion>","amount":10,"walletId":"wal_xxx","password":"tucontraseña"}'

# Minar
curl -X POST http://localhost:3001/api/v1/mine \
  -H "Content-Type: application/json" \
  -d '{"minerAddress":"P<direccion>"}'

curl http://localhost:3001/api/v1/mine/P<direccion>

# Mempool
curl http://localhost:3001/api/v1/transaction-pool
```

### Wallets

```bash
# Listar wallets
curl http://localhost:3001/api/v1/wallets

# Crear wallet
curl -X POST http://localhost:3001/api/v1/wallets/create \
  -H "Content-Type: application/json" \
  -d '{"name":"miwallet","password":"secreta"}'

# Importar wallet
curl -X POST http://localhost:3001/api/v1/wallets/import \
  -H "Content-Type: application/json" \
  -d '{"privateKey":"<hex64>","name":"importada","password":"secreta"}'

# Exportar clave privada
curl -X POST http://localhost:3001/api/v1/wallets/export \
  -H "Content-Type: application/json" \
  -d '{"walletId":"wal_xxx","password":"secreta"}'

# Saldo
curl http://localhost:3001/api/v1/wallets/<direccion>/balance
curl http://localhost:3001/api/v1/address/<direccion>

# Richlist
curl http://localhost:3001/api/v1/richlist

# UTXOs
curl http://localhost:3001/api/v1/utxos
```

### CNS (Crypto Name System)

```bash
# Registrar nombre
curl -X POST http://localhost:3001/api/v1/names/register \
  -H "Content-Type: application/json" \
  -d '{"name":"alice","address":"P<direccion>"}'

# Resolver nombre
curl http://localhost:3001/api/v1/names/resolve/alice

# Buscar por dirección
curl http://localhost:3001/api/v1/names/lookup/P<direccion>

# Listar nombres
curl http://localhost:3001/api/v1/names
```

### Red P2P

```bash
curl http://localhost:3001/api/v1/peers

curl -X POST http://localhost:3001/api/v1/peers/connect \
  -H "Content-Type: application/json" \
  -d '{"peers":["ws://192.168.1.2:6001"]}'
```

---

## Ejemplo de Flujo Completo

```bash
# 1. Iniciar el nodo
npm start

# 2. Registrar usuario admin (el primero es admin automáticamente)
blackcoin> register admin secreto123

# 3. Crear wallet
blackcoin> wallet:create miprimerawallet

# 4. Minar bloques para obtener saldo
blackcoin> mine P<direccion_de_wallet>

# 5. Verificar saldo
blackcoin> balance P<direccion_de_wallet>

# 6. Registrar un nombre CNS
blackcoin> name:register mialias P<direccion_de_wallet>

# 7. Crear otra wallet para amigo
blackcoin> wallet:create amigo

# 8. Enviar monedas usando el nombre CNS
blackcoin> send mialias.pro 10 <id_wallet_amigo>

# 9. Minar para confirmar la transacción
blackcoin> mine P<direccion_de_wallet>

# 10. Crear ticket de soporte
blackcoin> ticket:create Ayuda con envio No recibi las monedas

# 11. Ver tickets (admin ve todos)
blackcoin> admin:tickets

# 12. Responder ticket como admin
blackcoin> admin:reply tkt_xxx Las monedas llegaran en el proximo bloque
```

---

## Sistema de Roles

### Admin
- El **primer usuario** registrado es admin automáticamente
- Se puede registrar como admin con el código especial `BLACKADMIN2024`:
  ```bash
  blackcoin> register:admin admin2 password123
  # Te pedirá el código: BLACKADMIN2024
  ```
- Los admins pueden:
  - Ver todos los usuarios del sistema
  - Promover usuarios a admin
  - Degradar admins
  - Resetear contraseñas de usuarios
  - Eliminar usuarios
  - Ver todos los tickets de soporte
  - Responder y cerrar tickets

### Usuario regular
- Puede registrarse libremente
- Crear wallets, enviar/minar
- Crear tickets de soporte
- Ver solo sus propios tickets

---

## Estructura del Proyecto

### Raiz del proyecto

| Archivo | Proposito |
|---|---|
| `start-all.ps1` | Launcher PowerShell que instala dependencias, compila e inicia nodo + Discord bot |
| `start-all.bat` | Wrapper batch para `start-all.ps1` (doble-click) |
| `terminal.ps1` | Terminal interactiva para conectar al nodo via API |
| `verification-bot.exe` | Ejecutable standalone del Discord Verification Bot |

### Archivos fuente (`src/`)

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `src/types.ts` | ~110 | Tipos core: Block, Transaction, TxIn, TxOut, UTXO, WalletInfo, UserInfo, SupportTicket |
| `src/config.ts` | 88 | Carga de configuración (archivo + vars de entorno) |
| `src/logger.ts` | 38 | Logging coloreado con niveles |
| `src/events.ts` | 21 | Emisor de eventos simple |
| `src/database.ts` | 527 | Persistencia SQLite (better-sqlite3) para bloques, UTXOs, wallets, usuarios, tickets, sesiones, peers |
| `src/utils.ts` | 38 | Hashing (SHA-256), verificación PoW |
| `src/wallet.ts` | 140 | Creación/importación de wallets, gestión de claves (AES-256) |
| `src/names.ts` | 76 | Crypto Name System (CNS) |
| `src/transaction.ts` | 270 | Creación de transacciones, firmas, validación, halving |
| `src/transactionPool.ts` | 70 | Gestión del mempool |
| `src/blockchain.ts` | 270 | Gestión de cadena, minería, ajuste de dificultad, halving |
| `src/miner.ts` | 38 | Bucle de minería PoW |
| `src/p2p.ts` | 230 | Red P2P vía WebSocket con rate limiting |
| `src/discovery.ts` | 100 | Descubrimiento LAN/UDP broadcast |
| `src/users.ts` | 160 | Sistema de usuarios: registro, login, roles admin, gestión |
| `src/support.ts` | 176 | Sistema de tickets de soporte con chat, respuestas, cierre |
| `src/terminal.ts` | 155 | Terminal web para admins — comandos integrados + ejecucion segura en shell |
| `src/api.ts` | ~680 | API REST con Express: auth, admin, soporte, blockchain, wallets, CNS, terminal |
| `src/cli.ts` | ~450 | CLI interactiva con todos los comandos |
| `src/index.ts` | 35 | Punto de entrada |
| **Total** | **~3300** | |

---

## Configuración

### Archivo `config.json`

```json
{
  "network": "mainnet",
  "httpPort": 3001,
  "p2pPort": 6001,
  "blockGenerationInterval": 60,
  "difficultyAdjustmentInterval": 10,
  "coinbaseAmount": 50,
  "halvingInterval": 210000,
  "minDifficulty": 2,
  "miningThreads": 1,
  "dataDir": "./data",
  "bootstrapPeers": ["ws://192.168.1.2:6001"],
  "maxPeers": 20,
  "logLevel": "info"
}
```

### Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `HTTP_PORT` | Puerto API HTTP | 3001 |
| `P2P_PORT` | Puerto P2P WebSocket | 6001 |
| `DATA_DIR` | Directorio de datos | `./data` |
| `LOG_LEVEL` | Nivel de log (`error`, `warn`, `info`, `debug`) | `info` |
| `NETWORK` | Red (`mainnet`, `testnet`) | `mainnet` |
| `COINBASE_AMOUNT` | Recompensa inicial por bloque | 50 |
| `BOOTSTRAP_PEERS` | Pares iniciales (separados por coma) | - |

### Configuraciones incluidas

| Archivo | Propósito |
|---|---|
| `config.seed.json` | Config para nodo seed en VPS |
| `config.demo.json` | Demo con halving cada 10 bloques |
| `config.example.json` | Template de configuración |
| `.env.example` | Template de variables de entorno |

---

## Seguridad

### Protecciones implementadas

| Capa | Protección | Implementación |
|---|---|---|
| **Wallet** | Claves encriptadas AES-256 | `CryptoJS.AES.encrypt` con contraseña del usuario |
| **Wallet** | Sin almacenamiento en texto plano | No existe `wallet_secrets.json` |
| **Wallet** | Confirmación de contraseña al crear | CLI pide dos veces |
| **Wallet** | Rechazo de contraseña incorrecta | Descifrado fallido devuelve `null` |
| **Transacción** | Verificación de firma ECDSA | secp256k1, firmas DER |
| **Transacción** | Prueba de propiedad de dirección | Clave pública debe hacer hash a la dirección UTXO |
| **Transacción** | Prevención de doble gasto | UTXO marcado como gastado en pool + bloque |
| **Transacción** | Validación de entrada | NaN/Infinity/negativo/cantidades enormes rechazadas |
| **P2P** | Rate limiting de conexiones | Máx 5 conexiones por IP origen |
| **P2P** | Límite de pares | `maxPeers` configurable (default 20) |
| **P2P** | Prevención de auto-conexión | Detección por IP local y Node ID |
| **P2P** | Protección SSRF | Solo protocolo `ws://` aceptado |
| **Blockchain** | Validación de cadena | Verificación de génesis, hash chain, PoW |
| **Blockchain** | Ajuste de dificultad | Previene ataques de minería rápida |
| **API** | Validación de direcciones | Todas las direcciones validadas antes de procesar |
| **API** | Auth por wallet | `walletId` + `password` preferido sobre claves raw |
| **Usuarios** | Contraseñas hasheadas | SHA-256 con salt |
| **Usuarios** | Sesiones con expiración | Tokens expiran a las 24 horas |
| **Admin** | Protección de endpoints | Middleware `requireAdmin` en rutas sensibles |
| **Admin Terminal** | Comandos bloqueados | rm -rf, sudo, shutdown, format, etc. bloqueados |
| **Admin Terminal** | Timeout forzado | Comandos del sistema limitados a 15 segundos |
| **Admin Terminal** | Auditoría | Todos los comandos se registran en logs con tag `[TERMINAL]` |

### Limitaciones conocidas

- Sin TLS: tráfico HTTP y P2P no encriptado
- Sin autenticación de pares: cualquier nodo puede unirse
- Ataque del 51%: inherente a PoW
- Sin rate limiting en API
- CORS abierto: `Access-Control-Allow-Origin: *`
- Minería single-thread: CPU-only
- Contraseña en memoria: claves privadas descifradas en memoria del proceso

---

## Despliegue en VPS

```bash
# Opción 1: Script automático (Ubuntu/Debian)
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/blackcoin/main/setup-vps.sh | sudo bash

# Opción 2: Manual
rsync -avz --exclude node_modules --exclude .git ./blackcoin root@<vps-ip>:/opt/blackcoin
ssh root@<vps-ip>
cd /opt/blackcoin
npm install --omit=dev
npm run compile
cp blackcoin.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable blackcoin
systemctl start blackcoin

# Firewall
ufw allow 3001/tcp
ufw allow 6001/tcp
ufw allow 60000/udp
```

---

## Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `License.txt`.
