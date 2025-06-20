# 🎬 Mi Addon Personal para Stremio

Un addon personalizado para Stremio que te permite agregar tus propias películas, series y episodios a través de un panel de administración web intuitivo.

## ✨ Características

- 🎭 **Gestión completa de contenido**: Películas, series y episodios
- 🖥️ **Panel de administración web**: Interfaz intuitiva y responsive
- 📊 **Estadísticas en tiempo real**: Visualiza tu contenido de un vistazo
- 🔗 **Compatible con Stremio**: Protocolo oficial de addons
- 🚀 **Desplegable en Render.com**: Fácil deployment en la nube
- 📱 **Responsive**: Funciona en desktop, tablet y móvil

## 🚀 Despliegue en Render.com

### Paso 1: Preparar el repositorio

1. Crea un repositorio en GitHub
2. Sube todos los archivos del proyecto
3. Asegúrate de que la estructura sea:

```
mi-addon-stremio/
├── server.js
├── package.json
├── README.md
└── public/
    └── index.html
```

### Paso 2: Configurar Render.com

1. Ve a [render.com](https://render.com) y crea una cuenta
2. Conecta tu cuenta de GitHub
3. Crea un nuevo **Web Service**
4. Selecciona tu repositorio
5. Configura el servicio:
   - **Name**: `mi-addon-stremio`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (o el que prefieras)

### Paso 3: Variables de entorno (opcional)

Si necesitas configurar variables de entorno, puedes hacerlo en la sección Environment de Render.

### Paso 4: Desplegar

1. Haz clic en "Create Web Service"
2. Render automáticamente:
   - Clonará tu repositorio
   - Instalará las dependencias
   - Iniciará tu aplicación
3. Una vez completado, tendrás una URL como: `https://tu-addon.onrender.com`

## 📋 Uso del Addon

### Instalar en Stremio

1. Copia la URL de tu addon: `https://tu-addon.onrender.com/manifest.json`
2. Abre Stremio
3. Ve a **Addons** > **Community Addons**
4. Pega la URL en el campo de texto
5. Haz clic en **Install**

### Gestionar contenido

1. Ve a `https://tu-addon.onrender.com` en tu navegador
2. Usa el panel de administración para:
   - ➕ Agregar películas
   - 📺 Crear series
   - 🎞️ Añadir episodios
   - 📊 Ver estadísticas
   - 🗑️ Eliminar contenido

## 🎯 Campos de contenido

### Películas y Series
- **ID**: ID de IMDB (ej: tt1234567) o ID personalizado
- **Nombre**: Título del contenido
- **Año**: Año de lanzamiento
- **Géneros**: Separados por comas
- **Director**: Directores separados por comas
- **Reparto**: Actores separados por comas
- **Rating IMDB**: Puntuación (0-10)
- **Poster**: URL de la imagen del poster
- **Fondo**: URL de la imagen de fondo
- **Logo**: URL del logo
- **Descripción**: Sinopsis del contenido
- **Duración**: En minutos
- **URL**: Link directo al video (solo películas)
- **Calidad**: HD, Full HD, 4K, SD
- **Idioma**: Idioma del contenido

### Episodios (adicionales)
- **Serie**: Selecciona la serie padre
- **Temporada**: Número de temporada
- **Episodio**: Número de episodio
- **URL**: Link directo al video del episodio

## 🔧 Desarrollo local

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/mi-addon-stremio.git
cd mi-addon-stremio

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# El servidor estará disponible en http://localhost:3000
```

## 📝 Notas importantes

- **Almacenamiento**: Los datos se almacenan en memoria. Para producción, considera usar una base de datos
- **URLs de video**: Asegúrate de que los enlaces sean accesibles públicamente
- **CORS**: El addon está configurado para permitir CORS desde cualquier origen
- **Render.com**: En el plan gratuito, el servicio puede "dormir" tras 15 minutos de inactividad

## 🛠️ Personalización

### Cambiar configuración del addon

Edita las variables en `server.js`:

```javascript
const addonConfig = {
  id: 'com.tudominio.miaddon',
  name: 'Mi Addon Personal',
  description: 'Tu descripción personalizada',
  logo: 'URL_DE_TU_LOGO',
  // ... más configuraciones
};
```

### Agregar persistencia de datos

Para usar una base de datos real, puedes integrar:
- **MongoDB** con Mongoose
- **PostgreSQL** con Sequelize
- **SQLite** para simplicidad

## 🆘 Solución de problemas

### El addon no aparece en Stremio
- Verifica que la URL del manifest sea correcta
- Asegúrate de que el servicio esté corriendo
- Revisa los logs en Render.com

### Videos no se reproducen
- Verifica que las URLs sean accesibles
- Comprueba que el formato de video sea compatible
- Asegúrate de que no haya restricciones CORS

### Formulario no guarda datos
- Revisa la consola del navegador para errores
- Verifica que el backend esté respondiendo
- Comprueba los campos obligatorios

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## ⚠️ Disclaimer

Este addon es para uso personal y educativo. Asegúrate de cumplir con las leyes de copyright y términos de servicio aplicables al contenido que agregues.
