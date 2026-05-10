# Guia de Encendido Local - BlackCOIN

Guia paso a paso para poner el proyecto BlackCOIN completo funcionando en tu maquina local, incluyendo el nodo blockchain y el Discord Verification Bot.

---

## Indice

1. [Requisitos](#1-requisitos)
2. [Instalacion (Launcher automatico)](#2-instalacion-launcher-automatico)
3. [Instalacion Manual (solo nodo)](#3-instalacion-manual-solo-nodo)
4. [Primer arranque](#4-primer-arranque)
5. [Web Wallet](#5-web-wallet)
6. [Registro y admin](#6-registro-y-admin)
7. [Siguientes pasos](#7-siguientes-pasos)
8. [Solucion de problemas](#8-solucion-de-problemas)

---

## 1. Requisitos

| Requisito | Version |
|---|---|
| Node.js | >= 18.0.0 |
| npm | >= 9.0.0 |
| Sistema | Windows 10/11, Linux, macOS |

### Verificar instalacion

```powershell
# En Windows PowerShell
node --version
npm --version
```

Debes ver algo como `v18.x.x` y `9.x.x` o superior.

Si no tienes Node.js, descargalo de: https://nodejs.org/ (version LTS)

---

## 2. Instalacion (Launcher automatico)

### Paso 1: Abrir terminal

**Windows:** Abre PowerShell:
- Click derecho en Inicio → "Windows PowerShell" o "Terminal"

### Paso 2: Ejecutar el launcher

```powershell
cd C:\Users\xalex\Desktop\pruebas\BlackCOIN
.\start-all.bat
```

O directamente con PowerShell:

```powershell
.\start-all.ps1
```

### Que hace el launcher?

1. **Instala dependencias** de BlackCOIN y verification-bot si no existen
2. **Compila TypeScript** (si es necesario)
3. **Inicia el nodo BlackCOIN** en segundo plano
4. **Inicia el Discord Verification Bot** en segundo plano
5. **Mantiene un dashboard** mostrando el estado de ambos procesos
6. **Reinicia automaticamente** si algun proceso se cae
7. **Limpia procesos** al presionar Ctrl+C

### Que se inicia?

| Componente | URL / Puerto | Estado |
|---|---|---|
| **BlackCOIN Node** | `http://localhost:3001` | API + Web Wallet |
| **P2P Network** | `ws://localhost:6001` | Conexion entre nodos |
| **Discord Bot** | Via Discord API | Bot de verificacion |
| **Terminal** | `.\terminal.ps1` | CLI interactiva |

---

## 3. Instalacion Manual (solo nodo)

Si solo quieres el nodo sin el bot de Discord:

### Paso 1: Abrir terminal

**Windows:** Abre PowerShell como administrador:
- Click derecho en Inicio → "Windows PowerShell (Administrador)" o "Terminal (Administrador)"

### Paso 2: Ir a la carpeta del proyecto

```powershell
cd C:\Users\xalex\Desktop\pruebas\BlackCOIN
```

### Paso 3: Instalar dependencias

```powershell
npm install
```

Esto descarga todas las librerias necesarias (Express, SQLite, WebSocket, etc.).

### Paso 4: Compilar TypeScript

```powershell
npm run compile
```

Convierte el codigo TypeScript a JavaScript. Debe terminar sin errores (vuelve al prompt sin mensajes).

---

## 4. Primer arranque

### Iniciar el nodo (manual)

```powershell
npm start
```

Veras una pantalla como esta:

```
╔══════════════════════════════════════════════════════╗
║               BLACKCOIN NODE v1.0                     ║
║   Network: mainnet                                    ║
║   HTTP: 3001                                          ║
║   P2P:  6001                                          ║
╚══════════════════════════════════════════════════════╝

 Blockchain loaded: 1 blocks, 1 UTXOs
 P2P server listening on port 6001
 LAN discovery listening on port 60000
 HTTP API server listening on port 3001
```

### Que acaba de pasar?

- **HTTP API** → `http://localhost:3001` (la web)
- **P2P** → puerto `6001` (conexion con otros nodos)
- **LAN Discovery** → puerto `60000` UDP (encuentra nodos en la misma red)
- **CLI** → lista para recibir comandos

### Probar que funciona

Abre otro terminal y ejecuta:

```powershell
curl http://localhost:3001/healthz
```

Respuesta esperada:
```json
{"status":"ok","uptime":3.5,"blocks":1,"latestBlock":0,"peers":0,"memory":...}
```

---

## 5. Web Wallet

Abre tu navegador y ve a:

```
http://localhost:3001
```

### Pantalla de login

Veras la pantalla de inicio de sesion. Aun no tienes cuenta, asi que ve a la pestana **Registrarse**.

### Registro del primer usuario

El **primer usuario** registrado se convierte en **admin** automaticamente.

1. Ve a la pestana **Registrarse**
2. Usuario: `admin`
3. Contrasena: `admin1234`
4. Confirmar contrasena
5. Click en **Registrarse**

Al registrarte, entrara directamente al Dashboard.

### Dashboard

El panel principal muestra:
- Numero de bloques
- Transacciones
- UTXOs
- Mempool
- Pares conectados
- Ultimos bloques

### Navegacion lateral

| Enlace | Descripcion |
|---|---|
| **Dashboard** | Panel principal |
| **Wallet** | Crear, importar y ver carteras |
| **Enviar** | Enviar monedas a otra direccion |
| **Recibir** | Ver tu direccion para recibir pagos |
| **Minar** | Minar bloques para obtener monedas |
| **CNS Names** | Registrar nombres legibles (ej: alice.pro) |
| **Red** | Conectar a otros nodos |
| **Explorador** | Explorar blockchain, UTXOs, mempool |
| **Soporte** | Crear y ver tickets de soporte |
| **Perfil** (visible si logueado) | Info de cuenta y cambiar contrasena |
| **Admin** (visible si eres admin) | Panel de administracion + Terminal |
| **Cerrar Sesion** | Salir de la sesion |

---

## 6. Registro y admin

### Hacerse admin

**Opcion 1 — Primer usuario:**
El primer usuario registrado es admin automaticamente.

**Opcion 2 — Codigo especial:**
Si ya hay usuarios, usa el codigo `BLACKADMIN2024` al registrarte:
- En la web: registrate normalmente y luego pide a un admin que te promueva
- En la CLI: `register:admin usuario password` y te pedira el codigo

**Opcion 3 — Otro admin te promueve:**
Desde el Panel Admin → pestana Usuarios, click en "Hacer Admin".

### Crear una wallet

1. Ve a **Wallet** → pestana **Crear**
2. Nombre: `miwallet`
3. Contrasena: (minimo 4 caracteres)
4. Click en "Crear Cartera"

### Minar monedas

1. Ve a **Minar**
2. Selecciona tu wallet del desplegable
3. Click en "Minar un Bloque"
4. Espera unos segundos y veras el bloque minado

### Ver tu saldo

Ve a **Dashboard** o a **Wallet** → **Mis Carteras** y veras el balance.

---

## 7. Siguientes pasos

### Probar tickets de soporte

1. Ve a **Soporte** → **Nuevo Ticket**
2. Asunto y mensaje
3. Enviar
4. Se abrira el chat del ticket
5. Como eres admin, puedes responder y cerrar el ticket desde el mismo chat

### Probar la Terminal Admin

1. Ve a **Admin** → pestana **Terminal**
2. Prueba comandos integrados:
   - `help` — lista de comandos
   - `status` — estado del nodo
   - `users` — lista de usuarios
   - `tickets` — tickets de soporte
   - `wallets` — carteras registradas
   - `peers` — pares conectados
   - `clear` — limpia pantalla

### Probar comandos del sistema

Escribe cualquier comando de shell, ej:
- `node --version`
- `npm --version`
- `dir` (Windows) / `ls` (Linux)

### Conectar con otro nodo

Si tienes otro nodo en la misma red (o RadminVPN), ve a **Red**:
1. Introduce: `ws://<ip-del-otro>:6001`
2. Click en "Conectar"

---

## 8. Solucion de problemas

### Error: port already in use

```powershell
# Buscar que esta usando el puerto
netstat -ano | findstr :3001

# Matar el proceso (reemplazar PID con el numero)
taskkill /PID <PID> /F
```

### Error: Cannot find module

```powershell
npm install
npm run compile
```

### La web no carga

1. Verifica que `npm start` esta corriendo
2. Abre `http://localhost:3001` en el navegador
3. Revisa el terminal por errores

### Error de compilacion TypeScript

```powershell
npm run compile
```

Si hay errores de tipo, asegurate de haber ejecutado `npm install` primero.

### El nodo no responde

Presiona `Ctrl+C` para detenerlo y vuelve a iniciar:

```powershell
npm start
```

### Olvide la contrasena de admin

Si eres admin en la CLI:
```powershell
blackcoin> admin:reset-pass admin
```

O desde otro admin en el panel web: Admin → Usuarios → "Reset Pass".

### Resetear todos los datos

Deten el nodo (`Ctrl+C`) y elimina la carpeta data:

```powershell
# En Windows
rm -r data

# En Linux/Mac
rm -rf data
```

Al reiniciar, se creara un blockchain nuevo desde genesis.
