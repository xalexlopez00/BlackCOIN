# Guia de Administracion - BlackCOIN

Guia completa para administradores del nodo BlackCOIN: gestion de usuarios, tickets de soporte, seguridad, monitoreo y mantenimiento.

---

## Indice

1. [Como ser admin](#1-como-ser-admin)
2. [Comandos CLI para admin](#2-comandos-cli-para-admin)
3. [Gestion de usuarios](#3-gestion-de-usuarios)
4. [Sistema de Soporte (Chat)](#4-sistema-de-soporte-chat)
5. [Monitoreo y Logs](#5-monitoreo-y-logs)
6. [Gestion de Sesiones](#6-gestion-de-sesiones)
7. [Configuracion](#7-configuracion)
8. [Red P2P](#8-red-p2p)
9. [Seguridad](#9-seguridad)
10. [Mantenimiento](#10-mantenimiento)
11. [Panel de Administracion API](#11-panel-de-administracion-api)
12. [Terminal Web (Panel Admin)](#terminal-web-panel-admin)
13. [Solucion de problemas](#13-solucion-de-problemas)

---

## 1. Como ser admin

Hay tres formas de obtener privilegios de administrador:

### Opcion 1: Primer usuario (automatico)

El **primer usuario** registrado en el nodo es admin automaticamente:

```bash
blackcoin> register admin micontrasena
  Registered and logged in as admin (admin)
```

### Opcion 2: Codigo especial

Si ya existen usuarios, registrate como admin usando el codigo:

```bash
blackcoin> register:admin miusuario micontrasena
  Enter admin code: BLACKADMIN2024
  Registered and logged in as ADMIN: miusuario
```

El codigo por defecto es `BLACKADMIN2024`. Cambialo en `src/users.ts` para produccion.

### Opcion 3: Promovido por otro admin

Un admin existente puede promoverte:

```bash
blackcoin> admin:add miusuario
```

### Verificar tu rol

```bash
blackcoin> me
  Username: admin
  Role:     Admin
```

---

## 2. Comandos CLI para admin

Todos los comandos admin requieren haber iniciado sesion como admin (`login admin pass`).

### Gestion de usuarios

| Comando | Descripcion |
|---|---|
| `admin:users` | Listar todos los usuarios del sistema |
| `admin:add <user>` | Promover usuario a admin |
| `admin:remove <user>` | Degradar admin (no al ultimo) |
| `admin:reset-pass <user>` | Resetear contrasena de usuario |
| `admin:delete <user>` | Eliminar usuario (pide confirmacion) |

### Tickets de soporte

| Comando | Descripcion |
|---|---|
| `admin:tickets [open\|closed]` | Listar tickets (con filtro opcional) |
| `admin:ticket <id>` | Ver detalle completo con conversacion |
| `admin:reply <id> <msg>` | Responder y cerrar ticket |
| `admin:reply <id> <msg> -noclose` | Responder SIN cerrar ticket |
| `admin:ticket:close <id>` | Cerrar ticket sin responder |
| `admin:ticket:delete <id>` | Eliminar ticket (pide confirmacion) |

### Monitoreo

| Comando | Descripcion |
|---|---|
| `admin:stats` | Estadisticas completas del sistema |
| `admin:logs [n]` | Ver ultimos N logs (default: 50) |
| `admin:sessions` | Listar sesiones activas |
| `admin:revoke <token>` | Revocar una sesion |

### Configuracion

| Comando | Descripcion |
|---|---|
| `admin:settings` | Mostrar todas las configuraciones |
| `admin:setting <k> <v>` | Establecer una configuracion |
| `admin:log:level <level>` | Cambiar nivel de log en vivo (error\|warn\|info\|debug) |

### Red

| Comando | Descripcion |
|---|---|
| `admin:peers` | Mostrar peers almacenados |
| `admin:peers:cleanup` | Limpiar peers muertos (+10 fallos) |
| `admin:announce <msg>` | Enviar mensaje a todos los peers |

### Mantenimiento

| Comando | Descripcion |
|---|---|
| `admin:db:vacuum` | Compactar base de datos SQLite |

---

## 3. Gestion de usuarios

### Listar todos los usuarios

CLI:
```bash
blackcoin> admin:users

  Users (3):
  [ADMIN] admin (created: 2026-05-10T01:30:00.000Z)
  [USER]  user1 (created: 2026-05-10T01:31:00.000Z)
  [ADMIN] admin2 (created: 2026-05-10T01:32:00.000Z)
```

API:
```bash
curl http://localhost:3001/api/v1/admin/users \
  -H "Authorization: Bearer <token_admin>"
```

### Promover a admin

CLI:
```bash
blackcoin> admin:add user1
  user1 is now admin
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/admin/promote \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1"}'
```

### Degradar admin

CLI:
```bash
blackcoin> admin:remove user1
  user1 is no longer admin
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/admin/demote \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1"}'
```

> No puedes degradar al ultimo admin del sistema.

### Resetear contrasena

CLI:
```bash
blackcoin> admin:reset-pass user1
  New password: ****
  Password for user1 updated
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/admin/reset-password \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","newPassword":"nueva1234"}'
```

### Eliminar usuario

CLI:
```bash
blackcoin> admin:delete user1
  Are you sure you want to delete 'user1'? (yes/no): yes
  User user1 deleted
```

API:
```bash
curl -X DELETE http://localhost:3001/api/v1/admin/users/user1 \
  -H "Authorization: Bearer <token_admin>"
```

> No puedes eliminarte a ti mismo.

---

## 4. Sistema de Soporte (Chat)

El sistema de soporte funciona como un **chat** entre el usuario y el admin. Cada ticket tiene una conversacion completa con tipos de mensaje: `user`, `admin` y `system`.

### Ver todos los tickets

CLI:
```bash
blackcoin> admin:tickets

  All Support Tickets (3):
  [open] tkt_a1b2... - No puedo minar by user1 (2 replies)
  [closed] tkt_c3d4... - Ayuda con envio by user2 (1 replies)
```

Con filtro por estado:
```bash
blackcoin> admin:tickets open
blackcoin> admin:tickets closed
```

API:
```bash
curl http://localhost:3001/api/v1/support/tickets \
  -H "Authorization: Bearer <token_admin>"
```

### Ver detalle de un ticket (conversacion completa)

CLI:
```bash
blackcoin> admin:ticket tkt_a1b2c3d4

  ID:        tkt_a1b2c3d4
  Status:    open
  By:        user1
  Subject:   No puedo minar
  Created:   2026-05-10T01:30:00.000Z
  Updated:   2026-05-10T02:00:00.000Z

  --- Conversation ---
  [USER] user1: El minero no genera bloques
  [ADMIN] admin: Asegurate de tener saldo suficiente
          2026-05-10T01:45:00.000Z
  [USER] user1: Si tengo saldo, pero no funciona
          2026-05-10T02:00:00.000Z
  ---------------------
```

API:
```bash
curl http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4 \
  -H "Authorization: Bearer <token_admin>"
```

### Responder un ticket (cerrandolo)

CLI:
```bash
blackcoin> admin:reply tkt_a1b2c3d4 El problema ya esta solucionado
  Replied to ticket tkt_a1b2c3d4 and closed
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4/reply \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"reply":"Solucion: actualiza a la ultima version","closeAfterReply":true}'
```

### Responder SIN cerrar (seguir conversacion)

CLI:
```bash
blackcoin> admin:reply tkt_a1b2c3d4 Dame mas detalles del error -noclose
  Replied to ticket tkt_a1b2c3d4 (open)
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4/reply \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"reply":"Dame mas detalles","closeAfterReply":false}'
```

### Cerrar un ticket sin responder

CLI:
```bash
blackcoin> admin:ticket:close tkt_a1b2c3d4
  Ticket tkt_a1b2c3d4 closed
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4/close \
  -H "Authorization: Bearer <token_admin>"
```

### Reabrir un ticket

Lo puede hacer el dueno del ticket o un admin.

API:
```bash
curl -X POST http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4/reopen \
  -H "Authorization: Bearer <token_admin>"
```

CLI (usuario):
```bash
blackcoin> ticket:reopen tkt_a1b2c3d4
```

### Eliminar un ticket (admin)

CLI:
```bash
blackcoin> admin:ticket:delete tkt_a1b2c3d4
  Delete ticket 'tkt_a1b2c3d4'? (yes/no): yes
  Ticket tkt_a1b2c3d4 deleted
```

API:
```bash
curl -X DELETE http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4 \
  -H "Authorization: Bearer <token_admin>"
```

### Usuario responde a su ticket

CLI:
```bash
blackcoin> ticket:reply tkt_a1b2c3d4 Ya probe eso y sigue sin funcionar
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/support/tickets/tkt_a1b2c3d4/user-reply \
  -H "Authorization: Bearer <token_del_usuario>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Ya probe eso y sigue sin funcionar"}'
```

---

## 5. Monitoreo y Logs

### Estadisticas del sistema

CLI:
```bash
blackcoin> admin:stats

  Node Stats:
   Uptime:      0d 3h
   Memory:      85.3 MB RSS
   Blocks:      150
   Latest:      #149 (0000abcd...)
   Difficulty:  4
   UTXOs:       120
   Pool:        3
   Wallets:     5
   Users:       10
   Admins:      2
   Peers:       3
   Tickets:     15 (3 open, 12 closed)
```

API:
```bash
curl http://localhost:3001/api/v1/admin/stats \
  -H "Authorization: Bearer <token_admin>"
```

### Logs en tiempo real

CLI:
```bash
# Ver ultimos 50 logs
blackcoin> admin:logs

# Ver ultimos 200 logs
blackcoin> admin:logs 200
```

API:
```bash
curl "http://localhost:3001/api/v1/admin/logs?count=50" \
  -H "Authorization: Bearer <token_admin>"
```

### Cambiar nivel de log en vivo

```bash
blackcoin> admin:log:level debug
  Log level set to: debug
```

Niveles disponibles: `error`, `warn`, `info`, `debug`

El sistema de logging escribe a:
- **Consola**: con colores por nivel
- **Archivo**: `data/node.log` (rotacion manual)

### Log file

```bash
# Ver logs del archivo directamente
type data\node.log

# En Linux
tail -f data/node.log
```

---

## 6. Gestion de Sesiones

### Listar sesiones activas

CLI:
```bash
blackcoin> admin:sessions

  Active Sessions (3):
  a1b2c3d4e5f6... admin expires: 2026-05-11T01:30:00.000Z [active]
  7890abcd1234... user1 expires: 2026-05-11T01:31:00.000Z [active]
  ef0123456789... user2 expires: 2026-05-10T20:00:00.000Z [EXPIRED]
```

API:
```bash
curl http://localhost:3001/api/v1/admin/sessions \
  -H "Authorization: Bearer <token_admin>"
```

### Revocar una sesion

CLI:
```bash
blackcoin> admin:revoke a1b2c3d4e5f6g7h8i9j0...
  Session revoked
```

API:
```bash
curl -X DELETE "http://localhost:3001/api/v1/admin/sessions/a1b2c3d4e5f6g7h8i9j0..." \
  -H "Authorization: Bearer <token_admin>"
```

Las sesiones expiran automaticamente a las 24 horas. Las sesiones expiradas se limpian automaticamente al listar.

---

## 7. Configuracion

### Ver configuracion actual

CLI:
```bash
blackcoin> admin:settings

  Settings (3):
  db_version: 3
  maintenance_mode: false
  max_tickets_per_user: 10
```

### Establecer configuracion

CLI:
```bash
blackcoin> admin:setting maintenance_mode true
  Setting saved: maintenance_mode = true
```

API:
```bash
curl -X PUT http://localhost:3001/api/v1/admin/settings/maintenance_mode \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"value":"true"}'
```

### Eliminar configuracion

API:
```bash
curl -X DELETE http://localhost:3001/api/v1/admin/settings/maintenance_mode \
  -H "Authorization: Bearer <token_admin>"
```

---

## 8. Red P2P

### Ver peers almacenados

CLI:
```bash
blackcoin> admin:peers

  Stored Peers (3):
  ws://192.168.1.2:6001 (lastSeen: 2026-05-10T01:30:00.000Z, fails: 0)
  ws://192.168.1.3:6001 (lastSeen: 2026-05-10T01:00:00.000Z, fails: 3)
  ws://192.168.1.4:6001 (lastSeen: 2026-05-09T20:00:00.000Z, fails: 12)
```

API:
```bash
curl http://localhost:3001/api/v1/admin/peers \
  -H "Authorization: Bearer <token_admin>"
```

### Limpiar peers muertos

Elimina peers con mas de 10 fallos de conexion:

```bash
blackcoin> admin:peers:cleanup
  Removed 1 dead peers
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/admin/peers/cleanup \
  -H "Authorization: Bearer <token_admin>"
```

### Anunciar a todos los peers

Envia un mensaje a todos los peers conectados:

CLI:
```bash
blackcoin> admin:announce Mantenimiento programado en 10 minutos
  Announcement sent to 3 peers
```

API:
```bash
curl -X POST http://localhost:3001/api/v1/admin/announce \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Mantenimiento programado en 10 minutos"}'
```

---

## 9. Seguridad

### Proteccion de endpoints admin

Todos los endpoints de administracion estan protegidos por:
1. **Autenticacion**: Se requiere token valido via `Authorization: Bearer <token>`
2. **Middleware `requireAdmin`**: Verifica que el usuario tenga `isAdmin: true`
3. **Validaciones**: No se puede eliminar al ultimo admin, no te puedes eliminar a ti mismo

### Buenas practicas para admins

1. **Cambia el codigo admin por defecto**:
   El codigo `BLACKADMIN2024` esta fijo en `src/users.ts`. Cambialo:
   ```typescript
   const ADMIN_CODE = 'TU_CODIGO_SEGURO_AQUI';
   ```

2. **Usa contrasenas fuertes**: Minimo 8 caracteres con mezcla de mayusculas, minusculas y numeros.

3. **Limite de admins**: Manten el numero de admins al minimo necesario.

4. **Monitorea los logs**: El sistema registra todas las acciones admin con tag `[ADMIN]`:
   ```
   [ADMIN] admin promoted to admin by root
   [ADMIN] Ticket tkt_xxx replied by admin
   [ADMIN] Log level changed to debug by admin
   ```

5. **Revoca sesiones comprometidas**: Si sospechas que un token fue robado, revocalo con `admin:revoke <token>`.

### Tokens de sesion

- Los tokens expiran a las 24 horas
- Se almacenan en la base de datos (persistentes entre reinicios)
- Al revocar un token, el usuario pierde el acceso inmediatamente

---

## 10. Mantenimiento

### Respaldo de datos

```bash
# Respaldo completo
xcopy .\data .\backup-data-2026-05-10 /E /I

# Restaurar
xcopy .\backup-data-2026-05-10\* .\data\ /E /I
```

### Vacunar base de datos

Con el tiempo, SQLite puede fragmentarse. Vacuna la base de datos para recuperar espacio:

```bash
blackcoin> admin:db:vacuum
  Database vacuumed
```

### Ver logs del nodo

```bash
# Archivo de log
type data\node.log

# Salida de consola (si usas PM2 o similar)
pm2 logs blackcoin
```

### Healthcheck

```bash
curl http://localhost:3001/healthz
```

Respuesta:
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

### Limpiar datos de prueba

```bash
# Detener el nodo y eliminar datos
rm -rf .\data\*
# Al reiniciar se creara un nuevo genesis
```

---

## 11. Panel de Administracion API

### Resumen de endpoints

| Metodo | Endpoint | Descripcion |
|---|---|---|
| `GET` | `/api/v1/admin/users` | Listar todos los usuarios |
| `POST` | `/api/v1/admin/promote` | Promover usuario a admin |
| `POST` | `/api/v1/admin/demote` | Degradar admin |
| `POST` | `/api/v1/admin/reset-password` | Resetear contrasena |
| `DELETE` | `/api/v1/admin/users/:username` | Eliminar usuario |
| `GET` | `/api/v1/admin/stats` | Estadisticas del sistema |
| `GET` | `/api/v1/admin/logs` | Ver logs recientes |
| `GET` | `/api/v1/admin/settings` | Ver configuraciones |
| `PUT` | `/api/v1/admin/settings/:key` | Establecer configuracion |
| `DELETE` | `/api/v1/admin/settings/:key` | Eliminar configuracion |
| `GET` | `/api/v1/admin/peers` | Ver peers almacenados |
| `DELETE` | `/api/v1/admin/peers/:address` | Eliminar un peer |
| `POST` | `/api/v1/admin/peers/cleanup` | Limpiar peers muertos |
| `GET` | `/api/v1/admin/sessions` | Listar sesiones activas |
| `DELETE` | `/api/v1/admin/sessions/:token` | Revocar sesion |
| `POST` | `/api/v1/admin/terminal` | Ejecutar comando en terminal |
| `POST` | `/api/v1/admin/announce` | Anunciar a peers |
| `GET` | `/api/v1/support/tickets` | Listar tickets (todos) |
| `GET` | `/api/v1/support/tickets/:id` | Ver detalle de ticket |
| `POST` | `/api/v1/support/tickets/:id/reply` | Responder ticket |
| `POST` | `/api/v1/support/tickets/:id/close` | Cerrar ticket |
| `POST` | `/api/v1/support/tickets/:id/reopen` | Reabrir ticket |
| `DELETE` | `/api/v1/support/tickets/:id` | Eliminar ticket |

### Terminal Web (Panel Admin)

El panel de administracion web incluye una **Terminal** interactiva en la pestaña "Terminal".

#### Comandos integrados (no requieren shell)

| Comando | Descripcion |
|---|---|
| `help` / `?` | Muestra la ayuda con todos los comandos disponibles |
| `status` / `info` | Estado completo del nodo (bloques, pares, usuarios, tickets) |
| `users` | Lista de usuarios del sistema |
| `wallets` | Lista de carteras registradas |
| `tickets` | Todos los tickets de soporte |
| `peers` | Pares conectados actualmente |
| `mempool` | Transacciones pendientes en el mempool |
| `settings` | Configuraciones del nodo |
| `clear` / `cls` | Limpia la pantalla de la terminal |

Cualquier otro comando se ejecuta en la shell del sistema (con timeout de 15s).

#### Seguridad

- Solo accesible por usuarios con rol admin
- Comandos peligrosos bloqueados automaticamente (rm -rf, sudo, shutdown, format, etc.)
- Todos los comandos se registran en logs con tag `[TERMINAL]`
- Timeout forzado de 15 segundos para comandos del sistema

#### API

```bash
curl -X POST http://localhost:3001/api/v1/admin/terminal \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{"command":"status"}'
```

Respuesta:
```json
{
  "output": "[Node Status]\n  Bloques:     150\n  ...",
  "error": ""
}
```

### Script de ejemplo para gestion

```bash
#!/bin/bash
# gestion.sh - Script para administrar BlackCOIN via API

TOKEN="<token_admin>"
API="http://localhost:3001"

echo "=== USUARIOS ==="
curl -s "$API/api/v1/admin/users" -H "Authorization: Bearer $TOKEN" | \
  jq '.users[] | "\(if .isAdmin then "[ADMIN]" else "[USER]" end) \(.username)"'

echo ""
echo "=== ESTADISTICAS ==="
curl -s "$API/api/v1/admin/stats" -H "Authorization: Bearer $TOKEN"

echo ""
echo "=== TICKETS ABIERTOS ==="
curl -s "$API/api/v1/support/tickets" -H "Authorization: Bearer $TOKEN" | \
  jq '.tickets[] | select(.status=="open") | "\(.id) - \(.subject) by \(.username)"'

echo ""
echo "=== SESIONES ACTIVAS ==="
curl -s "$API/api/v1/admin/sessions" -H "Authorization: Bearer $TOKEN" | \
  jq '.sessions[] | select(.expiresAt > now) | "\(.username): \(.token[0:16])... expires \(.expiresAt | todate)"'
```

---

## 12. Solucion de problemas

### "Only admins can promote users"
No tienes permisos de admin. Verifica con `me` tu rol.

### "Cannot demote the last admin"
Debe haber al menos un admin en el sistema. Promueve a otro usuario primero.

### "Cannot delete yourself"
No puedes eliminar tu propio usuario. Pide a otro admin que lo haga.

### Usuario olvido su contrasena
Como admin, puedes resetearla:
```bash
blackcoin> admin:reset-pass user1
  New password: ****
  Password for user1 updated
```

### Ticket no aparece
- Los usuarios regulares solo ven sus propios tickets
- Como admin ves todos los tickets
- Verifica el estado del ticket (`open` / `closed`)
- Usa `admin:ticket <id>` para ver el detalle completo

### Error 401 en endpoints admin
- El token puede haber expirado (24 horas)
- Vuelve a iniciar sesion con `login`
- Verifica que el token se envia como `Authorization: Bearer <token>`

### Error "Cannot find module" al compilar
Ejecuta `npm install` y luego `npm run compile`.

### La base de datos se corrompio
Deten el nodo y ejecuta:
```bash
# Desde la carpeta del proyecto
node -e "const Database=require('better-sqlite3'); const d=new Database('./data/blackcoin.db'); d.exec('PRAGMA integrity_check'); d.close()"
```

Si esta corrupto, restaura desde el backup mas reciente.

### El nodo no arranca
1. Verifica que el puerto HTTP (3001) y P2P (6001) esten libres
2. Revisa `config.json` para configuracion personalizada
3. Revisa los logs en `data/node.log`
4. Verifica que `npm install` se haya ejecutado correctamente
