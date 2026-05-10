# 🪙 BlackCOIN - Professional Cryptocurrency Platform

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-7289DA?style=for-the-badge&logo=discord&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

**BlackCOIN** es una plataforma de criptomoneda de nivel profesional desarrollada en TypeScript. A diferencia de las implementaciones básicas, BlackCOIN integra una arquitectura robusta de servicios que incluye persistencia en base de datos SQL, gestión avanzada de usuarios, sistema de tickets de soporte y una red P2P con auto-descubrimiento.

---

## 💬 Comunidad y Soporte
¡Únete a nuestro servidor oficial de Discord para estar al tanto de las actualizaciones, soporte técnico y minería en comunidad!

👉 **[Unirse al Discord de BlackCOIN](https://discord.gg/GEFSfeutmP)**

---

## 🚀 Características Principales

### ⛓️ Core Blockchain
- **Modelo UTXO Completo:** Gestión precisa de salidas de transacciones no gastadas.
- **Prueba de Trabajo (PoW):** Algoritmo de minería con ajuste dinámico de dificultad.
- **Persistencia SQL:** Motor **SQLite** con modo WAL e índices optimizados para un acceso ultrarrápido a bloques y transacciones.
- **Halving Programado:** Reducción de recompensa por bloque para asegurar un modelo económico deflacionario.

### 🔐 Seguridad y Usuarios
- **Multi-Wallet:** Creación e importación de carteras con cifrado **AES-256**.
- **Gestión de Identidad:** Sistema de registro y login con sesiones protegidas por tokens.
- **Roles de Usuario:** Diferenciación entre usuarios regulares y Administradores (Panel de Control).
- **CNS (Crypto Name System):** Envío de monedas a alias humanos (ej: `alex.pro`) en lugar de hashes largos.

### 🌐 Red y Conectividad
- **P2P WebSocket:** Comunicación bidireccional entre nodos con límite de conexiones (Rate Limiting).
- **Descubrimiento LAN/VPN:** Auto-detección de pares mediante UDP Broadcast (compatible con RadminVPN y Hamachi).
- **Persistencia de Pares:** Almacenamiento de nodos conocidos para reconexión automática.

### 🛠️ Ecosistema de Soporte
- **Centro de Ayuda:** Sistema integrado de tickets de soporte técnico.
- **Panel de Admin:** Herramientas para que los administradores respondan tickets, gestionen usuarios y supervisen la red.

---

## 🛠️ Instalación y Uso Rápido

### Requisitos
- Node.js >= 18.0.0
- npm >= 9.0.0

### Pasos
1. **Clonar el repositorio:**
   ```bash
   git clone [https://github.com/xalexlopez00/BlackCOIN.git](https://github.com/xalexlopez00/BlackCOIN.git)
   cd BlackCOIN
