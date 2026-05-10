# Guía de Despliegue en VPS - BlackCOIN

Guía completa para poner un nodo BlackCOIN en un VPS (DigitalOcean, Hetzner, AWS, Linode, etc.).

---

## Índice

1. [Requisitos del VPS](#1-requisitos-del-vps)
2. [Instalación Rápida (1 comando)](#2-instalación-rápida-1-comando)
3. [Instalación Manual](#3-instalación-manual)
4. [Configuración](#4-configuración)
5. [Firewall y Seguridad](#5-firewall-y-seguridad)
6. [Monitoreo](#6-monitoreo)
7. [Mantenimiento](#7-mantenimiento)
8. [Solución de problemas](#8-solución-de-problemas)

---

## 1. Requisitos del VPS

### Especificaciones mínimas

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Disco | 10 GB | 20 GB SSD |
| SO | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |

### Puertos necesarios

| Puerto | Protocolo | Uso |
|---|---|---|
| `3001` | TCP | API HTTP + Web Wallet |
| `6001` | TCP | P2P WebSocket |
| `60000` | UDP | Descubrimiento LAN |

### Proveedores recomendados

| Proveedor | Precio mín. | Características |
|---|---|---|
| **Hetzner** | ~4€/mes | Mejor relación calidad/precio |
| **DigitalOcean** | ~6$/mes | Fácil de usar, droplets |
| **Linode** | ~5$/mes | Similar a DigitalOcean |
| **AWS EC2** | ~8$/mes | Más complejo, t2.micro free tier |

---

## 2. Instalación Rápida (1 comando)

### Opción A: Script automático

SSH a tu VPS y ejecuta:

```bash
curl -fsSL https://raw.githubusercontent.com/TU_ORG/blackcoin/main/setup-vps.sh | sudo bash
```

O si tienes el repositorio local:

```bash
# Sube el proyecto al VPS primero
rsync -avz --exclude node_modules --exclude .git ./blackcoin root@<vps-ip>:/opt/blackcoin

# SSH y ejecuta
ssh root@<vps-ip>
cd /opt/blackcoin
chmod +x setup-vps.sh
sudo ./setup-vps.sh
```

El script:
1. Instala Node.js 18+
2. Crea usuario `blackcoin`
3. Crea directorios (`/opt/blackcoin`, `/var/lib/blackcoin`, `/var/log/blackcoin`)
4. Despliega los archivos
5. Instala dependencias y compila
6. Configura el firewall (UFW/firewalld)
7. Instala servicio systemd
8. Configura rotación de logs
9. Inicia el nodo

### Opción B: PM2 (Node.js process manager)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Configurar como seed node
cp config.seed.json config.json

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Para que inicie automáticamente al reiniciar
```

---

## 3. Instalación Manual

### Paso 1: Conectarse al VPS

```bash
ssh root@<ip-del-vps>
```

### Paso 2: Instalar Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v  # Verificar: v18.x.x
```

### Paso 3: Crear usuario y directorios

```bash
# Crear usuario del sistema
useradd --system --no-create-home --shell /usr/sbin/nologin blackcoin

# Directorios
mkdir -p /opt/blackcoin
mkdir -p /var/lib/blackcoin/data
mkdir -p /var/log/blackcoin
mkdir -p /etc/blackcoin
```

### Paso 4: Subir el proyecto

Desde tu máquina local:
```bash
rsync -avz --exclude node_modules --exclude .git \
  ./blackcoin/ root@<vps-ip>:/opt/blackcoin/
```

### Paso 5: Instalar dependencias y compilar

```bash
cd /opt/blackcoin
npm install --omit=dev
npm run compile
```

### Paso 6: Configurar

```bash
cp config.seed.json /etc/blackcoin/config.json
# Editar configuración si es necesario
nano /etc/blackcoin/config.json
```

### Paso 7: Configurar permisos

```bash
chown -R blackcoin:blackcoin /opt/blackcoin /var/lib/blackcoin /var/log/blackcoin /etc/blackcoin
chmod 755 /opt/blackcoin
chmod 750 /var/lib/blackcoin /var/log/blackcoin /etc/blackcoin
```

### Paso 8: Instalar servicio systemd

```bash
cp /opt/blackcoin/blackcoin.service /etc/systemd/system/blackcoin.service
systemctl daemon-reload
systemctl enable blackcoin
systemctl start blackcoin
systemctl status blackcoin
```

### Paso 9: Configurar firewall

```bash
ufw allow 3001/tcp comment 'BlackCOIN HTTP API'
ufw allow 6001/tcp comment 'BlackCOIN P2P WebSocket'
ufw allow 60000/udp comment 'BlackCOIN LAN Discovery'
ufw enable
```

---

## 4. Configuración

### Archivo de configuración

Editar `/etc/blackcoin/config.json`:

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
  "dataDir": "/var/lib/blackcoin/data",
  "bootstrapPeers": [],
  "maxPeers": 50,
  "logLevel": "info"
}
```

Para un **nodo seed** público, asegúrate de:
- `maxPeers: 50` o más para aceptar muchas conexiones
- `bootstrapPeers: []` vacío porque este es el punto de entrada
- `logLevel: "info"` para logs normales, `"debug"` para diagnosticar

### Variables de entorno

Puedes sobrescribir la configuración con variables de entorno en `/etc/systemd/system/blackcoin.service`:

```ini
[Service]
Environment=NODE_ENV=production
Environment=HTTP_PORT=3001
Environment=P2P_PORT=6001
Environment=DATA_DIR=/var/lib/blackcoin/data
Environment=CONFIG_PATH=/etc/blackcoin/config.json
Environment=LOG_LEVEL=info
```

---

## 5. Firewall y Seguridad

### UFW (Uncomplicated Firewall)

```bash
# Configuración básica
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3001/tcp
ufw allow 6001/tcp
ufw allow 60000/udp
ufw enable
ufw status verbose
```

### Fail2ban (protección contra brute force)

```bash
apt-get install fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### Nginx como proxy inverso (opcional)

Si quieres servir la web wallet en el puerto 80/443 con SSL:

```nginx
server {
    listen 80;
    server_name blackcoin.ejemplo.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Y luego con Certbot para SSL:
```bash
apt-get install certbot python3-certbot-nginx
certbot --nginx -d blackcoin.ejemplo.com
```

### Recomendaciones de seguridad

1. **No expongas la API públicamente** si no es necesario. Usa un firewall.
2. **Cambia el código admin** en `src/users.ts` antes de compilar.
3. **Mantén el sistema actualizado**: `apt update && apt upgrade`
4. **Monitorea los logs**: `journalctl -u blackcoin -f`
5. **Backups regulares**: Copia `/var/lib/blackcoin/data/`

---

## 6. Monitoreo

### Healthcheck endpoint

```bash
curl http://localhost:3001/healthz
```

Respuesta esperada:
```json
{
  "status": "ok",
  "uptime": 3600.5,
  "blocks": 1500,
  "latestBlock": 1499,
  "peers": 23,
  "memory": 68546560
}
```

### Monitoreo con systemd

```bash
# Ver estado
systemctl status blackcoin

# Logs en tiempo real
journalctl -u blackcoin -f

# Últimas 50 líneas
journalctl -u blackcoin -n 50 --no-pager
```

### Monitoreo con scripts

```bash
#!/bin/bash
# check_blackcoin.sh - Script de monitoreo

API="http://localhost:3001"

# Verificar que el servicio está corriendo
if ! systemctl is-active --quiet blackcoin; then
    echo "BlackCOIN no está corriendo. Reiniciando..."
    systemctl restart blackcoin
    exit 1
fi

# Verificar healthcheck
HEALTH=$(curl -sf "$API/healthz")
if [ $? -ne 0 ]; then
    echo "Healthcheck falló"
    exit 1
fi

# Verificar número de bloques
BLOCKS=$(echo "$HEALTH" | grep -o '"blocks":[0-9]*' | cut -d: -f2)
echo "BlackCOIN OK - $BLOCKS bloques"

# Verificar pares conectados
PEERS=$(echo "$HEALTH" | grep -o '"peers":[0-9]*' | cut -d: -f2)
if [ "$PEERS" -eq 0 ]; then
    echo "ADVERTENCIA: Sin pares conectados"
fi
```

### Integración con UptimeRobot / Better Uptime

Usa la URL: `http://<tu-vps>:3001/healthz`
- Intervalo: 5 minutos
- Timeout: 30 segundos
- Alertas si status != "ok"

---

## 7. Mantenimiento

### Actualizar el nodo

```bash
# 1. Conectarse al VPS
ssh root@<vps-ip>

# 2. Ir al directorio
cd /opt/blackcoin

# 3. Actualizar código
git pull

# 4. Reinstalar dependencias (si cambiaron)
npm install --omit=dev

# 5. Recompilar
npm run compile

# 6. Reiniciar servicio
systemctl restart blackcoin

# 7. Verificar que inició correctamente
systemctl status blackcoin
journalctl -u blackcoin -n 20 --no-pager
```

### Backups

```bash
#!/bin/bash
# backup_blackcoin.sh

BACKUP_DIR="/backups/blackcoin"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup de datos
tar -czf "$BACKUP_DIR/blackcoin-data-$DATE.tar.gz" /var/lib/blackcoin/data/

# Backup de configuración
cp /etc/blackcoin/config.json "$BACKUP_DIR/config-$DATE.json"

# Mantener solo los últimos 7 backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completado: $BACKUP_DIR/blackcoin-data-$DATE.tar.gz"
```

Añadir al crontab:
```bash
crontab -e
# Añadir: 0 3 * * * /opt/blackcoin/backup_blackcoin.sh
```

### Rotación de logs

El archivo `/etc/logrotate.d/blackcoin` ya configurado:
```
/var/log/blackcoin/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

---

## 8. Solución de problemas

### El servicio no inicia

```bash
journalctl -u blackcoin -n 50 --no-pager
```

Errores comunes:
- **"Port already in use"**: Cambia los puertos en config.json
- **"Cannot find module"**: Faltó `npm install` o `npm run compile`
- **"Permission denied"**: Problema de permisos en directorios

### La API no responde

```bash
# Verificar que el puerto está escuchando
ss -tlnp | grep 3001

# Probar localmente
curl http://localhost:3001/healthz

# Verificar firewall
ufw status
```

### Sin conexiones P2P

```bash
# Verificar que el puerto P2P está abierto
ss -tlnp | grep 6001

# Verificar desde fuera (en otra máquina)
curl -X POST http://<vps-ip>:3001/api/v1/peers/connect \
  -H "Content-Type: application/json" \
  -d '{"peers":["ws://<vps-ip>:6001"]}'
```

### El nodo usa mucha memoria

```bash
# Verificar uso
journalctl -u blackcoin -n 20 | grep memory

# Reducir maxPeers en config.json
{ "maxPeers": 10 }

# O usar PM2 con límite de memoria
pm2 start dist/index.js --max-memory-restart 256M
```

### Error de disco lleno

```bash
# Verificar espacio
df -h

# Limpiar logs viejos
journalctl --vacuum-size=100M

# Limpiar backups viejos
find /backups -name "*.tar.gz" -mtime +30 -delete
```
