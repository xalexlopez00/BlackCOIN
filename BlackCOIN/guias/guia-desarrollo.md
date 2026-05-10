# Guía de Desarrollo - BlackCOIN

Guía para desarrolladores que quieren contribuir o modificar el código fuente de BlackCOIN.

---

## Índice

1. [Estructura del Proyecto](#1-estructura-del-proyecto)
2. [Entorno de Desarrollo](#2-entorno-de-desarrollo)
3. [Arquitectura](#3-arquitectura)
4. [Base de Datos](#4-base-de-datos)
5. [Tipos Principales](#5-tipos-principales)
6. [Guías de Estilo](#6-guías-de-estilo)
7. [Pruebas](#7-pruebas)
8. [Construcción y Despliegue](#8-construcción-y-despliegue)
9. [Contribuir](#9-contribuir)

---

## 1. Estructura del Proyecto

```
blackcoin/
├── src/                    # Código fuente TypeScript
│   ├── types.ts           # Tipos y clases principales
│   ├── config.ts          # Configuración
│   ├── logger.ts          # Logging
│   ├── events.ts          # Sistema de eventos
│   ├── database.ts        # Persistencia JSON
│   ├── utils.ts           # Utilidades de hash
│   ├── wallet.ts          # Gestión de wallets
│   ├── transaction.ts     # Transacciones
│   ├── transactionPool.ts # Mempool
│   ├── blockchain.ts      # Blockchain y minería
│   ├── miner.ts           # Bucle de minería PoW
│   ├── p2p.ts             # Red P2P WebSocket
│   ├── discovery.ts       # Descubrimiento LAN
│   ├── names.ts           # CNS - Crypto Name System
│   ├── users.ts           # Sistema de usuarios
│   ├── support.ts         # Tickets de soporte
│   ├── terminal.ts        # Terminal web para admins
│   ├── api.ts             # API REST Express
│   ├── cli.ts             # CLI interactiva
│   └── index.ts           # Punto de entrada
├── guias/                  # Guías de usuario
│   ├── guia-usuario.md
│   ├── guia-admin.md
│   ├── guia-vps.md
│   ├── guia-api.md
│   └── guia-desarrollo.md
├── public/                 # Web Wallet GUI
├── data/                   # Datos persistentes
├── dist/                   # Código compilado
├── node_modules/           # Dependencias
├── package.json
├── tsconfig.json
├── config.example.json
├── config.demo.json
├── config.seed.json
├── Dockerfile
├── docker-compose.yml
├── setup-vps.sh
├── blackcoin.service (systemd)
└── ecosystem.config.js
```

---

## 2. Entorno de Desarrollo

### Requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- TypeScript (se instala como devDependency)

### Setup

```bash
git clone <repo-url> blackcoin
cd blackcoin
npm install
```

### Launcher completo (nodo + bot)

```bash
# Desde la raiz del proyecto
cd ..
.\start-all.bat
```

Esto instala dependencias, compila e inicia tanto el nodo BlackCOIN como el bot de Discord automaticamente.

### Compilar solo el nodo

```bash
# Compilar TypeScript
npm run compile

# O usando ts-node directamente (sin compilar)
npm run dev
```

### Desarrollo con recarga automática

```bash
# Usa ts-node para desarrollo
npm run dev
```

Esto ejecuta `ts-node src/index.ts` que compila y ejecuta en memoria.

### Comandos disponibles

```bash
.\start-all.ps1    # Iniciar TODO (nodo + bot) con launcher automatico
.\start-all.bat    # Idem, version batch
npm run compile    # Compilar TypeScript a JavaScript
npm start          # Ejecutar versión compilada
npm run dev        # Ejecutar con ts-node (desarrollo)
npm run clean      # Limpiar carpeta dist
npm run rebuild    # Clean + compile
```

---

## 3. Arquitectura

### Flujo de inicio

```
index.ts
  ├── loadConfig()        → Cargar configuración
  ├── initBlockchain()    → Cargar/crar blockchain + UTXOs
  ├── initTransactionPool() → Cargar mempool
  ├── initP2PServer()     → Iniciar servidor WebSocket
  ├── connectToBootstrapPeers() → Conectar a pares iniciales
  ├── startDiscovery()    → Iniciar descubrimiento LAN
  ├── initHttpServer()    → Iniciar API REST
  └── promptUser()        → Iniciar CLI interactiva
```

### Flujo de una transacción

```
API: POST /api/v1/transactions/send
  → sendTransaction() en blockchain.ts
    → createTransaction() en transaction.ts
      → Validar dirección, cantidad
      → Buscar UTXOs disponibles (evitando los del mempool)
      → Crear TxIn, TxOut, firmar
    → addToTransactionPool() en transactionPool.ts
      → Validar transacción
      → Añadir al pool
      → Persistir a disco
    → emit('txpool:changed')
      → broadcastTransactionPool() a pares P2P
```

### Flujo de minería

```
CLI: mine <address>  o  API: GET /api/v1/mine/:address
  → generateNextBlock() en blockchain.ts
    → getCoinbaseAmount() → calcular recompensa (con halving)
    → getCoinbaseTransaction() → crear tx de recompensa
    → getTransactionPool() → obtener txs pendientes
    → mineBlock() en miner.ts
      → Bucle PoW: incrementar nonce, calcular hash
      → Cuando hash cumple dificultad, resolver
    → addBlockToChain()
      → processTransactions() → actualizar UTXOs
      → updateTransactionPool() → limpiar txs gastadas
      → Persistir bloque + UTXOs
      → emit('block:added')
```

### Sistema de eventos

El sistema de eventos (`events.ts`) es un pub/sub simple usado para notificar cambios:

```typescript
import { on, emit } from './events';

// Escuchar evento
on('block:added', (block) => { ... });

// Emitir evento
emit('block:added', newBlock);
```

Eventos disponibles:

| Evento | Disparado cuando | Datos |
|---|---|---|
| `block:added` | Nuevo bloque añadido a la cadena | El bloque |
| `chain:replaced` | La cadena fue reemplazada (sync) | - |
| `txpool:changed` | El mempool cambió | - |

---

## 4. Base de Datos

BlackCOIN usa **SQLite** (via `better-sqlite3`) para todo el almacenamiento. La base de datos se guarda en `data/blackcoin.db`.

### Esquema de base de datos

| Tabla | Contenido | Función |
|---|---|---|
| `blocks` | Blockchain completa | `db.loadBlocks()`, `db.saveBlocks()` |
| `utxos` | Salidas no gastadas | `db.loadUtxos()`, `db.saveUtxos()` |
| `txpool` | Transacciones pendientes | `db.loadTransactionPool()`, `db.saveTransactionPool()` |
| `wallets` | Wallets con claves encriptadas | `db.loadWallets()`, `db.saveWallets()` |
| `names` | Nombres CNS | `db.loadNames()`, `db.saveNames()` |
| `users` | Usuarios del sistema | `db.loadUsers()`, `db.saveUsers()` |
| `tickets` | Tickets de soporte | `db.loadTickets()`, `db.saveTickets()` |
| `sessions` | Sesiones activas | `db.saveSession()`, `db.loadSession()` |
| `peers` | Pares persistentes | `db.loadPeers()`, `db.savePeers()` |
| `settings` | Configuraciones clave-valor | `db.getSetting()`, `db.setSetting()` |

### Cómo funciona

El módulo `database.ts` usa SQLite directamente:

```typescript
export const db = {
  loadBlocks: (): Block[] => {
    const rows = getDB().prepare('SELECT * FROM blocks ORDER BY "index" ASC').all();
    return rows.map(r => new Block(r.index, r.hash, r.previousHash, r.timestamp, JSON.parse(r.data), r.difficulty, r.nonce));
  },
  saveBlocks: (blocks: Block[]): void => {
    const d = getDB();
    const tx = d.transaction(() => {
      d.prepare('DELETE FROM blocks').run();
      const insert = d.prepare('INSERT INTO blocks ...');
      for (const b of blocks) insert.run(...);
    });
    tx();
  },
  // ... más métodos
};
```

### Cambiar a otra base de datos

Para cambiar a PostgreSQL, MongoDB, etc., reemplaza las implementaciones en `database.ts`:

```typescript
export const db = {
  loadBlocks: async (): Promise<Block[]> => {
    // Implementación con tu DB
  },
  saveBlocks: async (blocks: Block[]): Promise<void> => {
    // Implementación con tu DB
  },
  // ...
};
```

---

## 5. Tipos Principales

Definidos en `src/types.ts`:

### Block

```typescript
class Block {
  constructor(
    public index: number,
    public hash: string,
    public previousHash: string,
    public timestamp: number,
    public data: Transaction[],
    public difficulty: number,
    public nonce: number
  ) {}
}
```

### Transaction

```typescript
class Transaction {
  id: string = '';
  txIns: TxIn[] = [];
  txOuts: TxOut[] = [];
  timestamp: number = 0;
  message: string = '';
}
```

### TxIn / TxOut

```typescript
class TxIn {
  txOutId: string = '';
  txOutIndex: number = 0;
  signature: string = '';
  publicKey: string = '';
}

class TxOut {
  constructor(public address: string, public amount: number) {}
}
```

### UnspentTxOut (UTXO)

```typescript
class UnspentTxOut {
  constructor(
    public readonly txOutId: string,
    public readonly txOutIndex: number,
    public readonly address: string,
    public readonly amount: number
  ) {}
}
```

### WalletInfo

```typescript
interface WalletInfo {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  encryptedPrivateKey: string;
  createdAt: number;
}
```

### SupportTicket

```typescript
interface TicketReply {
  by: string;
  message: string;
  createdAt: number;
}

interface SupportTicket {
  id: string;
  username: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt: number;
  txId?: string;
  replies?: TicketReply[];
}
```

### MessageType (P2P)

```typescript
enum MessageType {
  QUERY_LATEST = 0,
  QUERY_ALL = 1,
  RESPONSE_BLOCKCHAIN = 2,
  QUERY_TRANSACTION_POOL = 3,
  RESPONSE_TRANSACTION_POOL = 4,
  QUERY_PEERS = 5,
  RESPONSE_PEERS = 6,
}
```

---

## 6. Guías de Estilo

### TypeScript

- Usar `const` y `let`, nunca `var`
- Tipado explícito en funciones exportadas
- Clases para tipos de datos (Block, Transaction, etc.)
- Interfaces para objetos de datos (WalletInfo, UserInfo, etc.)
- Usar `import/export` (no `require`)

### Nombres

| Tipo | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case` | `transaction-pool.ts` |
| Clases | `PascalCase` | `class Block` |
| Interfaces | `PascalCase` | `interface WalletInfo` |
| Funciones | `camelCase` | `function getBalance()` |
| Variables | `camelCase` | `const unspentTxOuts` |
| Constantes | `UPPER_SNAKE_CASE` | `const GENESIS_HASH` |
| Enums | `PascalCase` | `enum MessageType` |
| Enum values | `UPPER_SNAKE_CASE` | `QUERY_LATEST` |

### Formato

- Indentación: 2 espacios
- Punto y coma al final de cada línea
- Comillas simples para strings
- Curly braces en la misma línea
- 120 caracteres máximo por línea

### Patrones

- **Funciones puras** para lógica de negocio (transaction.ts, blockchain.ts)
- **Exportaciones nombradas** siempre
- **Módulo db** como objeto con métodos para persistencia
- **Eventos** para comunicación entre módulos
- **try/catch** en todos los handlers de API y CLI

---

## 7. Pruebas

### Prueba manual

```bash
# 1. Iniciar nodo
npm start

# 2. Probar API con curl
curl http://localhost:3001/api/v1/info
curl http://localhost:3001/healthz

# 3. Crear wallet y minar
curl -X POST http://localhost:3001/api/v1/wallets/create \
  -H "Content-Type: application/json" \
  -d '{"name":"test","password":"test123"}'

# 4. Registrar usuario y probar soporte
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}'
```

### Prueba multi-nodo

```bash
# Terminal 1: Nodo seed
HTTP_PORT=3001 P2P_PORT=6001 npm start

# Terminal 2: Nodo normal
HTTP_PORT=3002 P2P_PORT=6002 npm start

# Conectar nodo 2 al nodo 1
curl -X POST http://localhost:3002/api/v1/peers/connect \
  -H "Content-Type: application/json" \
  -d '{"peers":["ws://localhost:6001"]}'
```

### Coverage de prueba

Para probar manualmente todas las funcionalidades:

1. **Blockchain**: Iniciar, minar, listar bloques
2. **Transacciones**: Crear wallet, minar, enviar, minar de nuevo, verificar saldo
3. **Wallets**: Crear, importar, exportar, ver saldo
4. **CNS**: Registrar, resolver, lookup, listar
5. **Red**: Conectar peers, verificar sincronización
6. **Usuarios**: Registrar, login, logout, me
7. **Admin**: promover, degradar, reset pass, eliminar
8. **Soporte**: Crear ticket, responder, cerrar, reabrir
9. **Terminal**: Comandos integrados (status, users, tickets), comandos shell

---

## 8. Construcción y Despliegue

### Compilar para producción

```bash
npm run compile
```

Esto genera archivos JS en `dist/`.

### Docker

```bash
# Construir imagen
docker-compose build

# Iniciar clúster de 3 nodos
docker-compose up

# Detener
docker-compose down
```

### Variables de entorno para producción

```bash
# Configurar antes de iniciar
export NODE_ENV=production
export HTTP_PORT=3001
export P2P_PORT=6001
export DATA_DIR=/var/lib/blackcoin/data
export CONFIG_PATH=/etc/blackcoin/config.json
export LOG_LEVEL=info
```

---

## 9. Contribuir

### Para añadir una nueva funcionalidad

1. Crea los tipos en `types.ts` si es necesario
2. Implementa la lógica en un nuevo archivo o añade a uno existente
3. Exporta las funciones principales
4. Conecta a la API en `api.ts` (nuevos endpoints)
5. Conecta a la CLI en `cli.ts` (nuevos comandos)
6. Actualiza `database.ts` si necesitas persistencia
7. Compila y prueba

### Para modificar el protocolo P2P

Los mensajes P2P se definen en `types.ts` (enum `MessageType`) y se manejan en `p2p.ts`. Para añadir un nuevo tipo de mensaje:

1. Añadir al enum `MessageType`
2. Añadir el case en `initMessageHandler()`
3. Añadir función para enviar el mensaje

### Para cambiar el algoritmo de minería

El bucle de minería está en `miner.ts`. La función `calculateHash()` en `utils.ts` define cómo se calcula el hash. Para cambiar el algoritmo PoW:

1. Modifica `calculateHash()` en `utils.ts`
2. Modifica `mineBlock()` en `miner.ts` si es necesario
3. Asegúrate de que `hashMatchesDifficulty()` siga funcionando

### Notas importantes

- No rompas la compatibilidad con versiones anteriores del protocolo P2P
- Mantén la persistencia SQLite funcional
- Todos los nuevos endpoints deben tener manejo de errores con try/catch
- Los comandos de la terminal web se definen en `src/terminal.ts` en la funcion `runBuiltin()`
- Documenta los cambios en el README.md
