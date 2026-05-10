# Guía de API REST - BlackCOIN

Referencia completa de la API REST de BlackCOIN con ejemplos de uso.

---

## Índice

1. [Introducción](#1-introducción)
2. [Autenticación](#2-autenticación)
3. [Blockchain](#3-blockchain)
4. [Transacciones](#4-transacciones)
5. [Minería](#5-minería)
6. [Wallets](#6-wallets)
7. [CNS - Crypto Name System](#7-cns---crypto-name-system)
8. [Red P2P](#8-red-p2p)
9. [Administración](#9-administración)
10. [Soporte Técnico](#10-soporte-técnico)
11. [Terminal (Admin)](#11-terminal-admin)
12. [Utilidades](#12-utilidades)

---

## 1. Introducción

### Base URL

```
http://localhost:3001
```

### Formato de respuestas

Todas las respuestas son JSON. Las respuestas exitosas contienen los datos solicitados. Los errores tienen la estructura:

```json
{
  "error": "Mensaje de error descriptivo"
}
```

### Códigos de estado HTTP

| Código | Significado |
|---|---|
| `200` | Éxito |
| `400` | Error de validación (datos incorrectos) |
| `401` | No autenticado |
| `403` | No autorizado (admin only) |
| `404` | Recurso no encontrado |

### Autenticación

Para endpoints que requieren autenticación, incluye el header:
```
Authorization: Bearer <token>
```

Obtén el token haciendo login o register.

---

## 2. Autenticación

### Register

```http
POST /api/v1/auth/register
```

Registra un nuevo usuario. El **primer usuario** registrado es admin automáticamente.

**Body:**
```json
{
  "username": "miusuario",
  "password": "micontraseña"
}
```

**Con código admin:**
```json
{
  "username": "miusuario",
  "password": "micontraseña",
  "adminCode": "BLACKADMIN2024"
}
```

**Respuesta:**
```json
{
  "success": true,
  "username": "miusuario",
  "token": "a1b2c3d4e5f6...",
  "isAdmin": false
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"usuario1","password":"pass1234"}'
```

### Login

```http
POST /api/v1/auth/login
```

**Body:**
```json
{
  "username": "miusuario",
  "password": "micontraseña"
}
```

**Respuesta:**
```json
{
  "success": true,
  "username": "miusuario",
  "token": "a1b2c3d4e5f6...",
  "isAdmin": false
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin1234"}'
```

### Logout

```http
POST /api/v1/auth/logout
```

**Headers:** `Authorization: Bearer <token>`

**Respuesta:**
```json
{
  "success": true
}
```

### Información del usuario actual

```http
GET /api/v1/auth/me
```

**Headers:** `Authorization: Bearer <token>`

**Respuesta:**
```json
{
  "username": "admin",
  "isAdmin": true,
  "createdAt": 1700000000000
}
```

---

## 3. Blockchain

### Info del nodo

```http
GET /api/v1/info
```

**Respuesta:**
```json
{
  "blocks": 150,
  "transactions": 234,
  "utxos": 120,
  "poolSize": 3,
  "peers": 5,
  "latestBlock": 149
}
```

### Healthcheck

```http
GET /healthz
```

**Respuesta:**
```json
{
  "status": "ok",
  "uptime": 3600.5,
  "blocks": 150,
  "latestBlock": 149,
  "peers": 5,
  "memory": 68546560
}
```

### Listar bloques (últimos 20)

```http
GET /api/v1/blocks
```

**Respuesta:**
```json
{
  "count": 150,
  "blocks": [
    { "index": 149, "hash": "0000abcd...", ... },
    { "index": 148, "hash": "0000ef01...", ... }
  ]
}
```

### Obtener todos los bloques

```http
GET /api/v1/blocks/all
```

**Respuesta:** Array de bloques.

### Último bloque

```http
GET /api/v1/blocks/latest
```

**Respuesta:**
```json
{
  "index": 149,
  "hash": "0000abcd1234...",
  "previousHash": "0000ef015678...",
  "timestamp": 1700000000,
  "data": [...],
  "difficulty": 4,
  "nonce": 12345
}
```

### Bloque por hash

```http
GET /api/v1/blocks/hash/:hash
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/blocks/hash/0000abcd1234...
```

### Bloque por índice

```http
GET /api/v1/blocks/index/:index
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/blocks/index/0  # Bloque génesis
```

---

## 4. Transacciones

### Obtener transacción por ID

```http
GET /api/v1/transactions/:txid
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/transactions/aba52ce3ae2d8e6a...
```

### Enviar transacción

```http
POST /api/v1/transactions/send
```

Crea una transacción y la añade al mempool. Requiere walletId+password o privateKey.

**Body:**
```json
{
  "to": "P<direccion_destino>",
  "amount": 10,
  "walletId": "wal_4f3f0518ec2c4ff2",
  "password": "micontraseña"
}
```

O usando clave privada directamente:
```json
{
  "to": "P<direccion_destino>",
  "amount": 10,
  "privateKey": "dc115989130f51acff..."
}
```

Soporta nombres CNS en `to`:
```json
{
  "to": "alice.pro",
  "amount": 10,
  "walletId": "wal_xxx",
  "password": "micontraseña"
}
```

Con mensaje opcional (max 280 chars):
```json
{
  "to": "P<direccion>",
  "amount": 10,
  "walletId": "wal_xxx",
  "password": "micontraseña",
  "message": "Gracias por la ayuda!"
}
```

**Respuesta:**
```json
{
  "success": true,
  "txid": "aba52ce3ae2d8e6a...",
  "txOuts": 2,
  "message": "Gracias por la ayuda!"
}
```

### Mempool (transacciones pendientes)

```http
GET /api/v1/transaction-pool
```

**Respuesta:** Array de transacciones pendientes de minar.

### UTXOs (salidas no gastadas)

```http
GET /api/v1/utxos
```

**Respuesta:**
```json
{
  "count": 120,
  "utxos": [
    {
      "txOutId": "aba52ce3...",
      "txOutIndex": 0,
      "address": "P<direccion>",
      "amount": 10
    }
  ]
}
```

---

## 5. Minería

### Minar bloque (POST)

```http
POST /api/v1/mine
```

**Body:**
```json
{
  "minerAddress": "P<tu_direccion>"
}
```

**Respuesta:**
```json
{
  "success": true,
  "blockHash": "0000abcd1234...",
  "blockIndex": 150,
  "txCount": 2
}
```

### Minar bloque (GET)

```http
GET /api/v1/mine/:address
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/mine/P<direccion>
```

---

## 6. Wallets

### Listar wallets

```http
GET /api/v1/wallets
```

**Respuesta:**
```json
[
  {
    "id": "wal_4f3f0518ec2c4ff2",
    "name": "miwallet",
    "address": "Pe6c1e232b7b03115af5889401e1a4acc72262f07",
    "createdAt": 1700000000000
  }
]
```

### Crear wallet

```http
POST /api/v1/wallets/create
```

**Body:**
```json
{
  "name": "miwallet",
  "password": "micontraseña"
}
```

**Respuesta:**
```json
{
  "success": true,
  "id": "wal_4f3f0518ec2c4ff2",
  "name": "miwallet",
  "address": "Pe6c1e232b7b03115af5889401e1a4acc72262f07"
}
```

### Importar wallet

```http
POST /api/v1/wallets/import
```

**Body:**
```json
{
  "privateKey": "dc115989130f51acff8984f69a3b0c014075ab0f39e267dd3db347efbad100c2",
  "name": "wallet_importada",
  "password": "micontraseña"
}
```

### Exportar clave privada

```http
POST /api/v1/wallets/export
```

**Body:**
```json
{
  "walletId": "wal_4f3f0518ec2c4ff2",
  "password": "micontraseña"
}
```

**Respuesta:**
```json
{
  "success": true,
  "privateKey": "dc115989130f51acff..."
}
```

### Ver saldo

```http
GET /api/v1/wallets/:address/balance
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/wallets/P<direccion>/balance
```

**Respuesta:**
```json
{
  "address": "P<direccion>",
  "balance": 50,
  "utxos": 1
}
```

### Ver dirección (saldo + UTXOs)

```http
GET /api/v1/address/:address
```

**Respuesta:**
```json
{
  "address": "P<direccion>",
  "balance": 50,
  "unspentTxOuts": [...]
}
```

### Richlist

```http
GET /api/v1/richlist
```

**Respuesta:**
```json
{
  "totalSupply": 21000000,
  "count": 20,
  "wallets": [
    { "id": "wal_xxx", "name": "top1", "address": "P<...>", "balance": 5000 },
    { "id": "wal_yyy", "name": "top2", "address": "P<...>", "balance": 3000 }
  ]
}
```

---

## 7. CNS - Crypto Name System

### Registrar nombre

```http
POST /api/v1/names/register
```

**Body:**
```json
{
  "name": "alice",
  "address": "P<direccion>"
}
```

**Respuesta:**
```json
{
  "success": true,
  "name": "alice.pro",
  "address": "P<direccion>"
}
```

### Resolver nombre

```http
GET /api/v1/names/resolve/:name
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/names/resolve/alice
```

**Respuesta:**
```json
{
  "name": "alice.pro",
  "address": "P<direccion>"
}
```

### Buscar por dirección

```http
GET /api/v1/names/lookup/:address
```

**Ejemplo:**
```bash
curl http://localhost:3001/api/v1/names/lookup/P<direccion>
```

**Respuesta:**
```json
{
  "address": "P<direccion>",
  "name": "alice.pro"
}
```

### Listar nombres

```http
GET /api/v1/names
```

**Respuesta:**
```json
{
  "count": 5,
  "names": [
    { "name": "alice", "address": "P<...>", "owner": "", "createdAt": 1700000000 }
  ]
}
```

---

## 8. Red P2P

### Ver pares conectados

```http
GET /api/v1/peers
```

**Respuesta:**
```json
{
  "count": 3,
  "peers": ["ws://192.168.1.2:6001", "ws://192.168.1.3:6001"]
}
```

### Conectar a pares

```http
POST /api/v1/peers/connect
```

**Body:**
```json
{
  "peers": ["ws://192.168.1.2:6001", "ws://192.168.1.3:6001"]
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Connecting to 2 peers..."
}
```

---

## 9. Administración

Todos los endpoints de administración requieren:
- Header: `Authorization: Bearer <token_admin>`
- El usuario debe tener `isAdmin: true`

### Listar usuarios

```http
GET /api/v1/admin/users
```

**Respuesta:**
```json
{
  "count": 3,
  "users": [
    { "username": "admin", "createdAt": 1700000000, "isAdmin": true },
    { "username": "user1", "createdAt": 1700000001, "isAdmin": false },
    { "username": "admin2", "createdAt": 1700000002, "isAdmin": true }
  ]
}
```

### Promover a admin

```http
POST /api/v1/admin/promote
```

**Body:**
```json
{ "username": "user1" }
```

**Respuesta:**
```json
{ "success": true, "username": "user1", "isAdmin": true }
```

### Degradar admin

```http
POST /api/v1/admin/demote
```

**Body:**
```json
{ "username": "admin2" }
```

**Respuesta:**
```json
{ "success": true, "username": "admin2", "isAdmin": false }
```

### Resetear contraseña

```http
POST /api/v1/admin/reset-password
```

**Body:**
```json
{ "username": "user1", "newPassword": "nueva1234" }
```

**Respuesta:**
```json
{ "success": true }
```

### Eliminar usuario

```http
DELETE /api/v1/admin/users/:username
```

**Ejemplo:**
```bash
curl -X DELETE http://localhost:3001/api/v1/admin/users/user1 \
  -H "Authorization: Bearer <token_admin>"
```

**Respuesta:**
```json
{ "success": true }
```

---

## 10. Soporte Técnico

### Crear ticket

```http
POST /api/v1/support/ticket
```

Requiere autenticación.

**Body:**
```json
{
  "subject": "No puedo minar",
  "message": "El minero no genera bloques"
}
```

**Con txId opcional:**
```json
{
  "subject": "Transacción perdida",
  "message": "Envié monedas pero no llegan",
  "txId": "aba52ce3ae2d8e6a..."
}
```

**Respuesta:**
```json
{
  "success": true,
  "ticket": {
    "id": "tkt_302aab8177a21a51",
    "username": "usuario1",
    "subject": "No puedo minar",
    "message": "El minero no genera bloques",
    "status": "open",
    "createdAt": 1700000000000
  }
}
```

### Listar tickets

```http
GET /api/v1/support/tickets
```

Requiere autenticación.
- Usuarios regulares: ven solo sus tickets
- Admins: ven todos los tickets

**Respuesta:**
```json
{
  "count": 1,
  "tickets": [...]
}
```

### Ver ticket

```http
GET /api/v1/support/tickets/:id
```

Requiere autenticación. Solo el dueño o admin pueden verlo.

**Respuesta:**
```json
{
  "id": "tkt_302aab8177a21a51",
  "username": "usuario1",
  "subject": "No puedo minar",
  "message": "El minero no genera bloques",
  "status": "closed",
  "createdAt": 1700000000000,
  "replies": [
    {
      "by": "admin",
      "message": "Asegúrate de tener saldo suficiente",
      "createdAt": 1700000005000
    }
  ]
}
```

### Responder ticket (admin)

```http
POST /api/v1/support/tickets/:id/reply
```

Requiere ser admin.

**Body:**
```json
{
  "reply": "Solución: actualiza a la última versión",
  "closeAfterReply": true
}
```

`closeAfterReply` es opcional (default: true).

**Respuesta:**
```json
{
  "success": true,
  "ticket": { "status": "closed", ... }
}
```

### Cerrar ticket (admin)

```http
POST /api/v1/support/tickets/:id/close
```

**Respuesta:**
```json
{
  "success": true,
  "ticket": { "status": "closed", ... }
}
```

### Reabrir ticket

```http
POST /api/v1/support/tickets/:id/reopen
```

Puede hacerlo el dueño del ticket o un admin.

**Respuesta:**
```json
{
  "success": true,
  "ticket": { "status": "open", ... }
}
```

### Eliminar ticket (admin)

```http
DELETE /api/v1/support/tickets/:id
```

**Respuesta:**
```json
{ "success": true }
```

---

## 11. Terminal (Admin)

### Ejecutar comando en terminal

```http
POST /api/v1/admin/terminal
```

Requiere ser admin.

**Body:**
```json
{
  "command": "status"
}
```

**Comandos integrados:** `help`, `status`, `users`, `wallets`, `tickets`, `peers`, `mempool`, `settings`, `clear`

Cualquier otro comando se ejecuta en la shell del sistema.

**Respuesta:**
```json
{
  "output": "[Node Status]\n  Bloques:     150\n  ...",
  "error": ""
}
```

**Ejemplo:**
```bash
curl -X POST http://localhost:3001/api/v1/admin/terminal \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}'
```

---

## 12. Utilidades

### Resumen de todos los endpoints

| Método | Endpoint | Auth | Admin | Descripción |
|---|---|---|---|---|
| `GET` | `/healthz` | - | - | Healthcheck |
| `GET` | `/api/v1/info` | - | - | Info del nodo |
| `GET` | `/api/v1/blocks` | - | - | Últimos 20 bloques |
| `GET` | `/api/v1/blocks/all` | - | - | Todos los bloques |
| `GET` | `/api/v1/blocks/latest` | - | - | Último bloque |
| `GET` | `/api/v1/blocks/hash/:hash` | - | - | Bloque por hash |
| `GET` | `/api/v1/blocks/index/:index` | - | - | Bloque por índice |
| `GET` | `/api/v1/transactions/:id` | - | - | Transacción por ID |
| `POST` | `/api/v1/transactions/send` | - | - | Enviar transacción |
| `GET` | `/api/v1/transaction-pool` | - | - | Mempool |
| `GET` | `/api/v1/utxos` | - | - | UTXOs |
| `GET` | `/api/v1/mine/:address` | - | - | Minar bloque |
| `POST` | `/api/v1/mine` | - | - | Minar bloque |
| `GET` | `/api/v1/wallets` | - | - | Listar wallets |
| `POST` | `/api/v1/wallets/create` | - | - | Crear wallet |
| `POST` | `/api/v1/wallets/import` | - | - | Importar wallet |
| `POST` | `/api/v1/wallets/export` | - | - | Exportar clave |
| `GET` | `/api/v1/wallets/:addr/balance` | - | - | Saldo |
| `GET` | `/api/v1/address/:addr` | - | - | Info dirección |
| `GET` | `/api/v1/richlist` | - | - | Top 20 wallets |
| `POST` | `/api/v1/names/register` | - | - | Registrar nombre |
| `GET` | `/api/v1/names` | - | - | Listar nombres |
| `GET` | `/api/v1/names/resolve/:name` | - | - | Resolver nombre |
| `GET` | `/api/v1/names/lookup/:addr` | - | - | Buscar por dirección |
| `GET` | `/api/v1/peers` | - | - | Pares conectados |
| `POST` | `/api/v1/peers/connect` | - | - | Conectar a pares |
| `POST` | `/api/v1/auth/register` | - | - | Registrar usuario |
| `POST` | `/api/v1/auth/login` | - | - | Iniciar sesión |
| `POST` | `/api/v1/auth/logout` | ✓ | - | Cerrar sesión |
| `GET` | `/api/v1/auth/me` | ✓ | - | Info usuario |
| `POST` | `/api/v1/support/ticket` | ✓ | - | Crear ticket |
| `GET` | `/api/v1/support/tickets` | ✓ | - | Listar tickets |
| `GET` | `/api/v1/support/tickets/:id` | ✓ | - | Ver ticket |
| `POST` | `/api/v1/support/tickets/:id/reopen` | ✓ | - | Reabrir ticket |
| `POST` | `/api/v1/support/tickets/:id/reply` | ✓ | ✓ | Responder ticket |
| `POST` | `/api/v1/support/tickets/:id/close` | ✓ | ✓ | Cerrar ticket |
| `DELETE` | `/api/v1/support/tickets/:id` | ✓ | ✓ | Eliminar ticket |
| `POST` | `/api/v1/admin/terminal` | ✓ | ✓ | Terminal ejecutar comando |
| `GET` | `/api/v1/admin/users` | ✓ | ✓ | Listar usuarios |
| `POST` | `/api/v1/admin/promote` | ✓ | ✓ | Promover admin |
| `POST` | `/api/v1/admin/demote` | ✓ | ✓ | Degradar admin |
| `POST` | `/api/v1/admin/reset-password` | ✓ | ✓ | Resetear pass |
| `DELETE` | `/api/v1/admin/users/:name` | ✓ | ✓ | Eliminar usuario |

### Leyenda
- `✓` = Requiere autenticación (token)
- `Admin` = Requiere ser administrador
- `-` = Acceso público
