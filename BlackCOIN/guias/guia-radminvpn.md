# Guia de Configuracion con RadminVPN - BlackCOIN

Guia completa para conectar nodos BlackCOIN entre si usando RadminVPN, ideal para minar y transacciones en red local virtual.

---

## Indice

1. [Que es RadminVPN?](#1-que-es-radminvpn)
2. [Instalacion de RadminVPN](#2-instalacion-de-radminvpn)
3. [Crear o unirse a una red](#3-crear-o-unirse-a-una-red)
4. [Configurar BlackCOIN](#4-configurar-blackcoin)
5. [Conexion entre nodos](#5-conexion-entre-nodos)
6. [Verificar que funciona](#6-verificar-que-funciona)
7. [Flujo completo](#7-flujo-completo)
8. [Solucion de problemas](#8-solucion-de-problemas)

---

## 1. Que es RadminVPN?

RadminVPN crea una **red local virtual** entre computadoras conectadas a internet. Es como si todos los PCs estuvieran en el mismo router, sin importar donde esten fisicamente.

### Por que usar RadminVPN con BlackCOIN?

| Sin RadminVPN | Con RadminVPN |
|---|---|
| Configuracion de puertos en router | Plug and play, sin configurar router |
| IP publica o DDNS necesaria | IPs virtuales fijas |
| Firewall y NAT problematicos | La red virtual no tiene NAT |
| Configuracion compleja | 3 clicks y estas dentro |

---

## 2. Instalacion de RadminVPN

### Paso 1: Descargar

Ve a: https://www.radmin-vpn.com/ y descarga la ultima version.

### Paso 2: Instalar

Ejecuta el instalador. Durante la instalacion:
- Acepta los terminos
- Deja todo por defecto
- Se instalara un adaptador de red virtual

### Paso 3: Abrir RadminVPN

Despues de instalar, se abre automaticamente. Te pedira:

1. **Seleccionar modo de uso**: "Usar RadminVPN"
2. **Elegir nombre**: Pon el nombre que quieras (ej: tu alias)

### Verificar instalacion

En Windows, abre PowerShell y ejecuta:

```powershell
ipconfig
```

Deberias ver un adaptador llamado "RadminVPN" o similar con una IP en el rango `26.x.x.x`.

---

## 3. Crear o unirse a una red

### Opcion A: Crear una red (servidor)

1. En RadminVPN, click en **"Crear red"**
2. Pon un nombre (ej: BlackCOIN-Miners)
3. Pon una contrasena
4. Comparte el nombre y contrasena con tus amigos
5. Todos los miembros de la red se veran entre si con IPs virtuales

### Opcion B: Unirse a una red existente

1. En RadminVPN, click en **"Unirse a red"**
2. Introduce el nombre de la red
3. Introduce la contrasena
4. Ya estas dentro

### Ver las IPs de los miembros

En RadminVPN veras una lista de miembros conectados con sus IPs virtuales (ej: `26.12.34.56`). Anota las IPs de los demas nodos.

Tambien puedes ver tu propia IP con:

```powershell
ipconfig
# Busca "Adaptador RadminVPN" -> "Direccion IPv4"
```

---

## 4. Configurar BlackCOIN

### Paso 1: Iniciar el proyecto

Cada persona debe tener el proyecto instalado y ejecutarlo. Hay dos formas:

**Opcion A — Launcher automatico (recomendado):**
```powershell
cd C:\Users\xalex\Desktop\pruebas\BlackCOIN
.\start-all.bat
```

**Opcion B — Solo el nodo:**
```powershell
cd C:\Users\xalex\Desktop\pruebas\BlackCOIN
npm start
```

### Paso 2: Registrar un usuario

En la CLI (consola donde corre BlackCOIN):

```text
blackcoin> register admin micontrasena
```

El primer usuario registrado en cada nodo es admin automaticamente.

### Paso 3: Crear una wallet

```text
blackcoin> wallet:create miwallet
```

O desde la web en `http://localhost:3001` → Wallet → Crear.

### Paso 4: Anotar la direccion de wallet

```text
blackcoin> wallets
```

Copia tu direccion (empieza con `P...`). La compartiras con otros para recibir monedas.

---

## 5. Conexion entre nodos

### Por Web (recomendado)

1. Abre `http://localhost:3001`
2. Inicia sesion
3. Ve a **Red** en el menu lateral
4. En "Conectar a par", introduce: `ws://26.x.x.x:6001` (la IP RadminVPN del otro nodo)
5. Click en **"Conectar"**

### Por CLI

```text
blackcoin> peer:connect ws://26.x.x.x:6001
```

### Que necesita cada nodo

Cada nodo debe conectarse a al menos un nodo de la red. Ejemplo con 3 nodos:

```
PC1 (26.12.34.56) ──conecta a──> PC2 (26.12.34.57)
PC2 (26.12.34.57) ──conecta a──> PC3 (26.12.34.58)
PC3 (26.12.34.58) ──conecta a──> PC2 (26.12.34.57)
```

No hace falta que todos se conecten a todos. Con que formen una cadena, el P2P sincroniza todo automaticamente.

### Configurar peers persistentes (opcional)

Para que al reiniciar el nodo se conecte automaticamente a los peers:

Edita `config.json` y añade los peers en `bootstrapPeers`:

```json
{
  "bootstrapPeers": [
    "ws://26.12.34.57:6001",
    "ws://26.12.34.58:6001"
  ]
}
```

---

## 6. Verificar que funciona

### Ver pares conectados

Por web: **Red** → veras la lista de pares conectados.

Por CLI:

```text
blackcoin> peers
```

Deberias ver algo como:
```
Connected Peers (2):
  ws://26.12.34.57:6001
  ws://26.12.34.58:6001
```

### Probar sincronizacion

1. **PC1** mina un bloque:
   ```text
   blackcoin> mine P<direccion_PC1>
   ```

2. Espera unos segundos

3. **PC2** verifica el bloque:
   ```text
   blackcoin> info
   ```
   Ambos nodos deben mostrar el mismo numero de bloques.

### Probar envio entre nodos

1. **PC1** envia monedas a **PC2**:
   ```text
   blackcoin> send P<direccion_PC2> 10 wal_id_PC1
   ```
   (Te pedira la contrasena de la wallet)

2. **PC1** mina un bloque para confirmar:
   ```text
   blackcoin> mine P<direccion_PC1>
   ```

3. **PC2** verifica su saldo:
   ```text
   blackcoin> balance P<direccion_PC2>
   ```

---

## 7. Flujo completo

### Escenario: 3 amigos minando juntos

#### Preparacion individual (cada uno hace esto)

1. Instalar Node.js
2. Clonar/descargar BlackCOIN
3. `npm install`
4. `npm run compile`
5. Instalar RadminVPN
6. Unirse a la red "BlackCOIN-Miners"

#### Configuracion de la red

1. **PC1 (Admin de la red):**
   - Abre RadminVPN → Crear red → "BlackCOIN-Miners" → contrasena
   - Anota su IP virtual (ej: 26.12.34.56)
   - Inicia BlackCOIN: `npm start`
   - Crea usuario y wallet

2. **PC2 y PC3:**
   - Abren RadminVPN → Unirse a red → "BlackCOIN-Miners" → contrasena
   - Inician BlackCOIN
   - Crean usuario y wallet

3. **Conectar los nodos:**
   - PC2 se conecta a PC1: `peer:connect ws://26.12.34.56:6001`
   - PC3 se conecta a PC1: `peer:connect ws://26.12.34.56:6001`

#### Probar la red

- PC1 mina 2 bloques → PC2 y PC3 ven los bloques nuevos
- PC2 envia 5 monedas a PC3 via web o CLI
- PC1 mina para confirmar → PC3 recibe las monedas
- Tickets de soporte funcionan entre nodos

---

## 8. Solucion de problemas

### No veo a los miembros en RadminVPN

- Todos deben estar en la **misma red** (mismo nombre y contrasena)
- Firewall de Windows puede bloquear RadminVPN:
  - Abre "Firewall de Windows Defender"
  - "Permitir una aplicacion a traves del firewall"
  - Agrega `RadminVPN.exe`
- Verifica que RadminVPN este conectado (icono verde)

### No puedo conectar al peer

```text
blackcoin> peer:connect ws://26.12.34.57:6001
```

Posibles causas:
- La IP es incorrecta — verifica con `ipconfig` en ambas maquinas
- El otro nodo no tiene BlackCOIN corriendo
- Puerto equivocado (debe ser `:6001` si no lo cambiaste)
- Firewall bloqueando el puerto 6001

Solucion rapida para firewall:

```powershell
# Permitir puerto 6001 en firewall
netsh advfirewall firewall add rule name="BlackCOIN P2P" dir=in action=allow protocol=TCP localport=6001
```

### Los nodos no se sincronizan

Despues de conectar, espera 5-10 segundos. La sincronizacion no es instantanea.

Verifica con:
```text
blackcoin> info
```

Si un nodo tiene menos bloques, se sincronizara automaticamente.

### Error: Connection refused

El nodo destino no esta corriendo o el puerto esta cerrado:
```powershell
# Verificar que el puerto esta escuchando
netstat -an | findstr :6001
```

### La IP de RadminVPN cambia

Las IPs RadminVPN son estaticas dentro de la misma red virtual, pero si alguien se desconecta y reconecta, puede cambiar. Verifica la IP cada vez que se reconecten.

### Alternativas a RadminVPN

| Alternativa | Tipo | Notas |
|---|---|---|
| **Hamachi** (LogMeIn) | Red virtual | Similar a Radmin, pero limitado a 5 personas en gratis |
| **ZeroTier** | Red virtual | Mas complejo, pero mas rapido y 25 personas gratis |
| **LAN local** | Red fisica | Si estan en la misma casa/oficina, no necesitan VPN |
| **VPS publico** | Servidor en la nube | Para red permanente 24/7 |

Para cambiar a ZeroTier o Hamachi, solo cambia la IP en `peer:connect ws://IP:6001`.

### RadminVPN de pago?

RadminVPN tiene una version gratuita que permite hasta ... personas en una red. La version de pago elimina el limite. Para uso personal, la version gratuita es suficiente.
