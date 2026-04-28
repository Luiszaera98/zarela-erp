# Manual de Instalación y Despliegue - Zarela ERP

Este documento detalla los pasos para instalar y desplegar el sistema ERP "Zarela" desde cero en una computadora o servidor limpio (sin dependencias instaladas previamente).

## 1. Prerrequisitos de Software

El sistema está contenedorizado con Docker, por lo que **no necesitas** instalar Node.js, MongoDB ni ninguna otra librería directamente en el sistema operativo.

La única herramienta necesaria es **Docker Desktop** (si usas Windows/Mac) o **Docker Engine + Docker Compose** (si usas Linux Server).

### Instalación de Docker

#### Para Windows (Tu caso):
1.  Descarga **Docker Desktop para Windows** desde: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2.  Ejecuta el instalador y sigue las instrucciones. Asegúrate de que WSL 2 (Windows Subsystem for Linux) esté seleccionado si el instalador lo sugiere.
3.  Una vez instalado, abre "Docker Desktop" y espera a que el icono de la ballena en la barra de tareas se quede fijo (verde).

#### Git (Opcional pero recomendado para clonar el código):
1.  Descarga Git desde: [https://git-scm.com/downloads](https://git-scm.com/downloads)
2.  Instálalo con las opciones por defecto.

---

## 2. Obtener el Código Fuente

Tienes dos opciones para poner el código en el nuevo servidor:

### Opción A: Clonar desde GitHub (Recomendado)
Si ya subiste el código a un repositorio privado:
1.  Abre una terminal (PowerShell o CMD).
2.  Navega a la carpeta donde quieres instalarlo (ej. Escritorio):
    ```bash
    cd Desktop
    ```
3.  Clona el repositorio:
    ```bash
    git clone https://github.com/TU_USUARIO/zarela-erp.git
    ```
4.  Entra a la carpeta del proyecto:
    ```bash
    cd zarela-erp
    ```

### Opción B: Copiar Carpeta
Simplemente copia la carpeta entera de tu proyecto actual (asegúrate de **NO** copiar las carpetas `node_modules` ni `.next` para ahorrar tiempo y espacio) a un USB o por red, y pégala en el nuevo servidor.

---

## 3. Configuración Inicial

### Configuración de Seguridad (IMPORTANTE)

1.  Una vez descargado el código, localiza el archivo `.env.example`.
2.  Crea una copia de este archivo y llámala `.env`:
    ```bash
    cp .env.example .env
    ```
3.  Abre el archivo `.env` con un editor de texto (Bloc de notas, nano, etc.).
4.  **Cambia las contraseñas por defecto:**
    *   Modifica `DB_PASSWORD` por una contraseña segura.
    *   Modifica `DB_USER` si lo deseas.
    *   Define `JWT_SECRET`.
    *   Si la instalación es nueva y no existe ningún usuario, define `ADMIN_PASSWORD`, `SALES_PASSWORD` y `INVENTORY_PASSWORD`.
    *   Guarda el archivo.
    *   *El archivo `docker-compose.prod.yml` leerá automáticamente estas variables para configurar la base de datos y la conexión.*

---

## 4. Despliegue (Ejecución del Sistema)

Para un entorno de producción (servidor doméstico), usaremos la configuración optimizada.

1.  Abre la terminal en la carpeta del proyecto.
2.  Ejecuta el siguiente comando para construir y levantar los contenedores:

    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

    *   `-f docker-compose.prod.yml`: Indica que use el archivo de configuración de producción.
    *   `up`: Levanta los servicios.
    *   `-d`: (Detached) Ejecuta en segundo plano, liberando la terminal.
    *   `--build`: Fuerza la construcción de la imagen (necesario la primera vez o cuando actualizas código).

3.  Espera unos minutos. La primera vez tardará porque descargará las imágenes de Node y Mongo, y compilará la aplicación Next.js.

4.  Verifica que todo esté corriendo con:
    ```bash
    docker compose -f docker-compose.prod.yml ps
    ```
    Deberías ver dos servicios (`web` y `mongodb`) con estado "Up".

---

## 5. Acceso a la Aplicación

1.  Abre tu navegador web (Chrome, Edge, etc.).
2.  Ingresa a: `http://localhost:3000`
3.  ¡Listo! Deberías ver la pantalla de inicio de sesión.
    *   Si instalaste en otra PC de tu red y quieres acceder desde tu móvil u otra laptop, averigua la IP de ese servidor (ej. ejecuta `ipconfig` en terminal y busca IPv4 Address).
    *   Luego accede como: `http://192.168.1.X:3000`

---

## 6. Mantenimiento y Actualizaciones

### Si modificas código y lo subes a GitHub:
En el servidor:
1.  Baja los cambios:
    ```bash
    git pull
    ```
2.  Reconstruye y reinicia:
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

### Regresión e-CF antes de desplegar
Ejecuta esta validación base para no romper la lógica e-CF ya certificada:
```bash
npm run test:ecf-regression
```

### Copias de Seguridad (Base de Datos)
Los datos de la base de datos se guardan en un volumen de Docker del proyecto `zarela-erp`. Incluso si borras los contenedores, los datos persisten.

Para hacer un backup manual de la base de datos:
```bash
docker exec zarela_mongodb mongodump --archive --gzip > backup_fecha.gz
```

---

## Solución de Problemas Comunes

*   **Error "Ports are not available":** Si el puerto 3000 está ocupado, abre `docker-compose.prod.yml` y cambia `"3000:3000"` por `"4000:3000"`, luego accede por `http://localhost:4000`.
*   **La app no carga:** Revisa los logs para ver errores:
    ```bash
    docker compose -f docker-compose.prod.yml logs -f web
    ```

## Notas operativas DGII

*   Los endpoints que consume la DGII deben seguir públicos. La matriz actual está documentada en [docs/DGII_PUBLIC_ENDPOINTS.md](docs/DGII_PUBLIC_ENDPOINTS.md).
*   Antes de cualquier pase, sigue [docs/SAFE_ROLLOUT_CHECKLIST.md](docs/SAFE_ROLLOUT_CHECKLIST.md).
