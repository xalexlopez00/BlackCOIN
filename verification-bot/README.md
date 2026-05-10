# Verification Bot

Bot de Discord completo con verificación de identidad, sistema de tickets, sugerencias y transcripciones.

## Requisitos

- Node.js 18+
- Bot creado en el [Discord Developer Portal](https://discord.com/developers/applications)
- Permisos del bot: `bot` + `applications.commands`

## Instalación

```bash
cd verification-bot
npm install
```

## Configuración Inicial

### 1. Crear la estructura del servidor Discord

Crea las siguientes **categorías y canales** en tu servidor:

```
📋 INFORMACION (categoría)
├── #bienvenida
├── #reglas
└── #anuncios

🔐 VERIFICACION (categoría)
├── #verificate         ← aquí se usa /verify
└── #ayuda

🎫 SOPORTE (categoría)
└── (canales de tickets - los crea el bot automáticamente)

🛡️ RECUPERACION (categoría)
└── (canales de tickets - los crea el bot)

⚠️ REPORTES (categoría)
└── (canales de tickets - los crea el bot)

📝 APELACIONES (categoría)
└── (canales de tickets - los crea el bot)

💡 SUGERENCIAS (categoría)
└── #sugerencias       ← aquí se publican /suggest

📊 LOGS (categoría) - Solo visible para STAFF
├── #logs-verificacion
├── #logs-tickets
├── #logs-sugerencias
└── #transcripciones

🔒 STAFF (categoría) - Solo visible para STAFF
├── #staff-chat
└── #anuncios-staff
```

### 2. Obtener los IDs

Activa **Modo Desarrollador** en Discord (Ajustes → Avanzado → Modo Desarrollador).
Luego haz clic derecho en cada elemento y selecciona "Copiar ID":

| Elemento | Cómo obtener el ID |
|---|---|
| **CLIENT_ID** | Discord Developer Portal → General Information |
| **GUILD_ID** | Clic derecho en el nombre del servidor |
| **VERIFY_LOG_CHANNEL_ID** | Clic derecho en `#logs-verificacion` |
| **TICKET_LOG_CHANNEL_ID** | Clic derecho en `#logs-tickets` |
| **SUGGEST_LOG_CHANNEL_ID** | Clic derecho en `#logs-sugerencias` |
| **TRANSCRIPT_CHANNEL_ID** | Clic derecho en `#transcripciones` |
| **TICKET_CATEGORY_ID** | Clic derecho en `🎫 SOPORTE` |
| **RECOVERY_CATEGORY_ID** | Clic derecho en `🛡️ RECUPERACION` |
| **REPORT_CATEGORY_ID** | Clic derecho en `⚠️ REPORTES` |
| **APPEAL_CATEGORY_ID** | Clic derecho en `📝 APELACIONES` |
| **SUGGESTIONS_CHANNEL_ID** | Clic derecho en `#sugerencias` |
| **STAFF_ROLE_ID** | Ajustes del servidor → Roles → clic derecho en el rol staff |

### 3. Configurar el archivo `.env`

Edita `.env` y pega cada ID en su variable correspondiente.

### 4. Activar Intents del Bot

En el [Discord Developer Portal](https://discord.com/developers/applications):
1. Selecciona tu aplicación
2. Ve a **Bot** (menú izquierdo)
3. Activa estos **Privileged Gateway Intents**:
   - ☑ PRESENCE INTENT
   - ☑ SERVER MEMBERS INTENT
   - ☑ MESSAGE CONTENT INTENT

### 5. Invitar el Bot al servidor

Usa la URL generada en el portal OAuth2 con los scopes:
- `bot`
- `applications.commands`

Permisos necesarios del bot:
- Ver canales
- Enviar mensajes
- Usar comandos de barra diagonal
- Gestionar canales (para crear tickets)

## Inicio Rapido (Con el proyecto completo)

El proyecto incluye un **launcher automatico** que instala dependencias e inicia tanto el nodo BlackCOIN como el bot:

```powershell
# Desde la raiz del proyecto
.\start-all.bat
```

## Uso (solo el bot)

### Registrar comandos

```bash
cd verification-bot
npm run deploy
```

### Iniciar el bot

```bash
npm start
```

O usando el ejecutable:
```bash
.\verification-bot.exe
```

## Comandos Disponibles

### Para todos los usuarios

| Comando | Descripción | Ejemplo |
|---|---|---|
| `/verify` | Envía un DM para verificar tu identidad | `/verify` |
| `/ticket soporte` | Abre un ticket de soporte general | `/ticket soporte` |
| `/ticket recuperacion` | Abre un ticket para recuperar cuenta | `/ticket recuperacion` |
| `/ticket reporte` | Abre un ticket para reportar a alguien | `/ticket reporte` |
| `/ticket apelacion` | Abre un ticket para apelar sanción | `/ticket apelacion` |
| `/suggest <texto>` | Envía una sugerencia al servidor | `/suggest Mejoraría...` |

### Solo para staff

| Comando | Descripción | Ejemplo |
|---|---|---|
| `/close` | Cierra el ticket actual (con confirmación) | `/close` |
| `/add @usuario` | Añade un usuario al ticket actual | `/add @usuario` |

## Flujo de funcionamiento

### Verificación de identidad
1. Usuario escribe `/verify` en cualquier canal
2. El bot envía un mensaje privado con botones
3. Usuario hace clic en "Sí, soy yo" o "No, no soy yo"
4. El resultado se registra en `#logs-verificacion`

### Sistema de tickets
1. Usuario escribe `/ticket <tipo>` en cualquier canal
2. El bot crea un canal privado en la categoría correspondiente
3. El usuario y el staff pueden conversar en ese canal
4. Cuando se soluciona, un staff usa `/close` o el botón "Cerrar Ticket"
5. El bot confirma y al aceptar:
   - Guarda **transcripción completa** en `#transcripciones` (archivo .txt)
   - Envía log a `#logs-tickets`
   - Notifica al usuario por DM
   - Elimina el canal

### Sugerencias
1. Usuario escribe `/suggest <texto>` en cualquier canal
2. El bot publica la sugerencia en `#sugerencias`
3. Otros usuarios votan con botones "A favor" / "En contra"
4. Se registra en `#logs-sugerencias`

## Estructura del proyecto

```
verification-bot/
├── .env                # Configuración (IDs, token) - NO SUBIR A GITHUB
├── .gitignore          # Archivos ignorados por git
├── package.json        # Dependencias y scripts
├── index.js            # Código principal del bot (7 funciones)
├── deploy-commands.js  # Registro de comandos slash
└── README.md           # Esta documentación
```

**Total: 5 archivos de código** (excluyendo node_modules, .env y .gitignore)

## Notas importantes

- El bot debe estar **corriendo** para que los comandos funcionen
- Los comandos tardan unos minutos en aparecer después de `npm run deploy`
- Los usuarios deben tener **DMs abiertos** para recibir la verificación
- Las transcripciones se guardan como archivos .txt en `#transcripciones`
- El `.env` contiene el token del bot — **nunca lo subas a GitHub**
