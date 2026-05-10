# Guía de Usuario - BlackCOIN

Guía completa para usar BlackCOIN como usuario normal: wallets, transacciones, minería, CNS y tickets de soporte.

---

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Wallets](#2-wallets)
3. [Transacciones](#3-transacciones)
4. [Minería](#4-minería)
5. [CNS - Crypto Name System](#5-cns---crypto-name-system)
6. [Soporte Técnico](#6-soporte-técnico)
7. [Autenticación](#7-autenticación)
8. [Preguntas Frecuentes](#8-preguntas-frecuentes)

---

## 1. Primeros pasos

### Requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0

### Instalación

```bash
git clone <repo-url> blackcoin
cd blackcoin
npm install
npm run compile
```

### Inicio rápido (launcher automático)

```powershell
# Desde la carpeta raiz del proyecto
.\start-all.bat
```

Esto instala dependencias, compila e inicia el nodo + bot de Discord automaticamente.

### Iniciar solo el nodo (manual)

```bash
npm start
```

Al iniciar verás:

```
╔══════════════════════════════════════════════════════╗
║               BLACKCOIN NODE v1.0                     ║
║   Network: mainnet                                    ║
║   HTTP: 3001                                          ║
║   P2P:  6001                                          ║
║   Data: ./data                                        ║
╚══════════════════════════════════════════════════════╝
```

El nodo inicia automáticamente:
- API HTTP en `http://localhost:3001`
- Servidor P2P en puerto 6001
- CLI interactiva lista para usar
- Web Wallet GUI en `http://localhost:3001`

### La CLI

La interfaz de línea de comandos usa el prompt `blackcoin> `.

```bash
blackcoin> help    # Muestra todos los comandos
blackcoin> info    # Estado del nodo
blackcoin> exit    # Detener el nodo
```

---

## 2. Wallets

### Crear una wallet

```bash
blackcoin> wallet:create miwallet
  Enter password (min 4 chars): ****
  Confirm password: ****

  Wallet created!
  ID:      wal_4f3f0518ec2c4ff2
  Name:    miwallet
  Address: Pe6c1e232b7b03115af5889401e1a4acc72262f07
```

Las direcciones BlackCOIN empiezan con `P` seguidas de 40 caracteres hex.

### Listar wallets

```bash
blackcoin> wallets

  Wallets (1):
  [wal_4f3f0518...] miwallet - Pe6c1e232b7b03115af5889401e1a4acc72262f07 balance: 0
```

### Ver detalles de una wallet

```bash
blackcoin> wallet:show Pe6c1e232b7b03115af5889401e1a4acc72262f07

  ID:        wal_4f3f0518ec2c4ff2
  Name:      miwallet
  Address:   Pe6c1e232b7b03115af5889401e1a4acc72262f07
  PublicKey: 04a8c827f9d56b416b912909ad1516a2b...
  Balance:   0
  Created:   2026-05-10T01:30:00.000Z
```

### Ver saldo

```bash
blackcoin> balance Pe6c1e232b7b03115af5889401e1a4acc72262f07
  Balance of Pe6c1e232b7b03115af5889401e1a4acc72262f07: 50
```

### Importar wallet desde clave privada

```bash
blackcoin> wallet:import <clave_privada_hex> nombre_wallet
  Enter password (min 4 chars): ****
  Confirm password: ****
  Wallet imported: nombre_wallet (P<direccion>)
```

### Exportar clave privada

```bash
blackcoin> wallet:export wal_4f3f0518ec2c4ff2
  Enter password: ****
  Private key: dc115989130f51acff8984f69a3b0c014075ab0f39e267dd3db347efbad100c2
```

> **IMPORTANTE**: Guarda tu clave privada en un lugar seguro. Cualquiera que la tenga puede gastar tus monedas.

---

## 3. Transacciones

### Enviar monedas

```bash
blackcoin> send P<direccion_destino> 10 wal_4f3f0518ec2c4ff2
  Enter wallet password: ****
  Transaction sent: aba52ce3ae2d8e6a84029546c3d0eb2136f988aa541d45a6ba8ed65832d634e1
```

También puedes enviar usando nombres CNS:

```bash
blackcoin> send alice.pro 10 wal_4f3f0518ec2c4ff2
  Resolved alice.pro -> P<direccion_de_alice>
  Transaction sent: <txid>
```

### Ver transacciones pendientes (mempool)

```bash
blackcoin> pool

  Transaction Pool (1):
  aba52ce3ae2d8e6a... amount: 10
```

### Ver UTXOs (salidas no gastadas)

```bash
blackcoin> utxos

  Unspent TX Outputs (2):
  d03afdefcff61cab...[0] Pe6c1e232b7b03115af5889401e1a4acc72262f07 -> 50
  aba52ce3ae2d8e6a...[0] P<direccion_destino> -> 10
```

> Las transacciones se añaden al mempool primero. Para que se confirmen, necesitan ser incluidas en un bloque mediante minería.

---

## 4. Minería

### Minar un bloque

```bash
blackcoin> mine P<tu_direccion>
  Mining... (the node remains responsive during mining)
  Block #1 mined! 506b410356a1357f...
```

Cada bloque minado te otorga una recompensa (coinbase). Por defecto son 50 monedas, y se reduce a la mitad cada 210,000 bloques.

### Ver el blockchain

```bash
blackcoin> blockchain

  Blockchain (2 blocks):
  #0 [000000000000...] Genesis | 1 tx(s) | diff: 0
  #1 [506b410356a1...] 2026-05-10T01:30:00.000Z | 1 tx(s) | diff: 0
```

### Ver detalles de un bloque

```bash
blackcoin> block 1

  Block #1
  Hash:        506b410356a1357ffda446e56c13c67bd1d8c728925c4ee5562e262b18c62650
  Previous:    0000000000000000000000000000000000000000000000000000000000000000
  Timestamp:   2026-05-10T01:30:00.000Z
  Difficulty:  0
  Nonce:       0
  Transactions:
    506b410356a1357f...
      Out: P<direccion> -> 50
```

---

## 5. CNS - Crypto Name System

El CNS permite registrar nombres legibles para tus direcciones. En lugar de enviar monedas a `Pe6c1e232b7b03115af5889401e1a4acc72262f07`, puedes enviar a `alice.pro`.

### Registrar un nombre

```bash
blackcoin> name:register alice P<tu_direccion>
  Registered: alice.pro -> P<tu_direccion>
```

### Resolver un nombre

```bash
blackcoin> name:resolve alice.pro
  alice.pro -> P<direccion>
```

### Buscar nombre por dirección

```bash
blackcoin> name:lookup P<direccion>
  P<direccion> -> alice.pro
```

### Listar todos los nombres

```bash
blackcoin> names

  CNS Names (1):
  alice.pro -> P<direccion>
```

Reglas de nombres:
- 2-32 caracteres
- Letras, números, guiones y guiones bajos
- No distingue mayúsculas/minúsculas
- El sufijo `.pro` se añade automáticamente

---

## 6. Soporte Técnico

Puedes crear tickets de soporte para reportar problemas o hacer preguntas.

### Requisitos

Debes estar autenticado. Si no lo estás:

```bash
blackcoin> register miusuario micontraseña
```

O si ya tienes cuenta:

```bash
blackcoin> login miusuario micontraseña
```

### Crear un ticket

```bash
blackcoin> ticket:create No puedo minar El minero no genera bloques
  Ticket created: tkt_302aab8177a21a51
  Subject: No puedo minar
```

### Ver tus tickets

```bash
blackcoin> ticket:list

  Tickets (1):
  [open] tkt_302aab8177a21a51 - No puedo minar (0 replies)
```

### Ver detalle de un ticket

```bash
blackcoin> ticket:show tkt_302aab8177a21a51

  ID:       tkt_302aab8177a21a51
  Status:   closed
  By:       miusuario
  Subject:  No puedo minar
  Message:  El minero no genera bloques
  Created:  2026-05-10T01:30:00.000Z
  Replies:
    #1 by admin at 2026-05-10T01:31:00.000Z
       Asegúrate de tener saldo para pagar la tarifa
```

### Reabrir un ticket

```bash
blackcoin> ticket:reopen tkt_302aab8177a21a51
  Ticket tkt_302aab8177a21a51 reopened
```

---

## 7. Autenticación

### Registrar un nuevo usuario

```bash
blackcoin> register miusuario micontraseña
  Registered and logged in as miusuario
```

### Iniciar sesión

```bash
blackcoin> login miusuario micontraseña
  Logged in as miusuario
```

### Cerrar sesión

```bash
blackcoin> logout
  Logged out
```

### Ver información del usuario actual

```bash
blackcoin> me
  Username: miusuario
  Role:     User
```

> NOTA: La autenticación es necesaria solo para el sistema de soporte y administración. Las wallets y transacciones funcionan sin autenticación.

---

## 8. Preguntas Frecuentes

### ¿Cómo obtengo mis primeras monedas?
Crea una wallet y mina un bloque:
```bash
blackcoin> wallet:create primerawallet
blackcoin> mine P<direccion>
```

### ¿Por qué mi transacción no aparece?
Las transacciones van primero al mempool. Debes minar un bloque para confirmarlas:
```bash
blackcoin> mine P<direccion>
```

### ¿Cómo conecto con otros nodos?
```bash
blackcoin> peer:connect ws://192.168.1.2:6001
```

O en la misma LAN se conectan automáticamente.

### ¿Dónde se guardan mis datos?
Todo está en `./data/`:
- `blocks.json` - blockchain
- `utxos.json` - salidas no gastadas
- `txpool.json` - transacciones pendientes
- `wallets.json` - wallets (claves encriptadas)
- `names.json` - nombres CNS
- `users.json` - usuarios del sistema
- `tickets.json` - tickets de soporte

### ¿Cómo hago backup de mis wallets?
Copia el archivo `data/wallets.json` y recuerda tus contraseñas. También puedes exportar claves privadas individuales con `wallet:export`.
