const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ruta del archivo de datos
const DATA_FILE = path.join(__dirname, 'content-database.json');

// Estructura inicial de la base de datos
const initialDatabase = {
  movies: [],
  series: [],
  episodes: []
};

// Funciones para manejo de archivos
async function loadDatabase() {
  try {
    // Verificar si el archivo existe
    await fs.access(DATA_FILE);
    
    // Leer el archivo
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    
    // Validar estructura
    if (!parsed.movies || !parsed.series || !parsed.episodes) {
      console.log('⚠️ Estructura de datos incompleta, inicializando...');
      return initialDatabase;
    }
    
    console.log('✅ Base de datos cargada exitosamente');
    console.log(`📊 Contenido: ${parsed.movies.length} películas, ${parsed.series.length} series, ${parsed.episodes.length} episodios`);
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📁 Archivo de base de datos no encontrado, creando uno nuevo...');
      await saveDatabase(initialDatabase);
      return initialDatabase;
    } else {
      console.error('❌ Error cargando base de datos:', error);
      throw error;
    }
  }
}

async function saveDatabase(data) {
  try {
    // Crear backup del archivo anterior si existe
    try {
      await fs.access(DATA_FILE);
      const backupFile = DATA_FILE.replace('.json', `-backup-${Date.now()}.json`);
      await fs.copyFile(DATA_FILE, backupFile);
      console.log(`💾 Backup creado: ${path.basename(backupFile)}`);
    } catch (error) {
      // El archivo no existe, no hay problema
    }
    
    // Guardar los datos con formato legible
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('💿 Base de datos guardada exitosamente');
  } catch (error) {
    console.error('❌ Error guardando base de datos:', error);
    throw error;
  }
}

// Cargar la base de datos al iniciar
let contentDatabase = {};

// Configuración del addon
const addonConfig = {
  id: 'com.tudominio.myaddon',
  version: '1.0.0',
  name: 'Mi Addon Personal',
  description: 'Addon personalizado para agregar contenido propio',
  logo: 'https://via.placeholder.com/200x200.png?text=Mi+Addon',
  background: 'https://via.placeholder.com/1920x1080.png?text=Background',
  types: ['movie', 'series'],
  catalogs: [
    {
      type: 'movie',
      id: 'my-movies',
      name: 'Mis Películas'
    },
    {
      type: 'series',
      id: 'my-series',
      name: 'Mis Series'
    }
  ],
  resources: ['catalog', 'meta', 'stream'],
  idPrefixes: ['tt', 'custom']
};

// Ruta principal del addon - Manifiesto
app.get('/manifest.json', (req, res) => {
  res.json(addonConfig);
});

// Ruta del catálogo
app.get('/catalog/:type/:id.json', (req, res) => {
  const { type, id } = req.params;
  
  let metas = [];
  
  if (type === 'movie' && id === 'my-movies') {
    metas = contentDatabase.movies.map(movie => ({
      id: movie.id,
      type: 'movie',
      name: movie.name,
      poster: movie.poster,
      background: movie.background,
      logo: movie.logo,
      description: movie.description,
      year: movie.year,
      imdbRating: movie.imdbRating,
      genre: movie.genre,
      director: movie.director,
      cast: movie.cast
    }));
  } else if (type === 'series' && id === 'my-series') {
    metas = contentDatabase.series.map(series => ({
      id: series.id,
      type: 'series',
      name: series.name,
      poster: series.poster,
      background: series.background,
      logo: series.logo,
      description: series.description,
      year: series.year,
      imdbRating: series.imdbRating,
      genre: series.genre,
      director: series.director,
      cast: series.cast
    }));
  }
  
  res.json({ metas });
});

// Ruta de metadatos
app.get('/meta/:type/:id.json', (req, res) => {
  const { type, id } = req.params;
  
  let meta = null;
  
  if (type === 'movie') {
    meta = contentDatabase.movies.find(movie => movie.id === id);
  } else if (type === 'series') {
    const series = contentDatabase.series.find(series => series.id === id);
    if (series) {
      // Obtener episodios de la serie
      const episodes = contentDatabase.episodes.filter(ep => ep.seriesId === id);
      
      // Ordenar episodios por temporada y episodio
      episodes.sort((a, b) => {
        if (a.season !== b.season) {
          return a.season - b.season;
        }
        return a.episode - b.episode;
      });
      
      const videos = episodes.map(ep => ({
        id: `${id}:${ep.season}:${ep.episode}`,
        title: `S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')} - ${ep.name}`,
        season: ep.season,
        episode: ep.episode,
        overview: ep.description || '',
        thumbnail: ep.poster || series.poster,
        released: ep.year ? new Date(ep.year, 0, 1).toISOString() : new Date().toISOString(),
        runtime: ep.runtime || series.runtime
      }));
      
      meta = {
        ...series,
        videos: videos
      };
    }
  }
  
  if (meta) {
    res.json({ meta });
  } else {
    res.status(404).json({ error: 'Content not found' });
  }
});

// Ruta de streams
app.get('/stream/:type/:id.json', (req, res) => {
  const { type, id } = req.params;
  
  console.log(`Stream request: type=${type}, id=${id}`);
  
  let streams = [];
  
  if (type === 'movie') {
    const movie = contentDatabase.movies.find(movie => movie.id === id);
    if (movie && movie.url) {
      streams.push({
        url: movie.url,
        title: `${movie.quality || 'HD'} - ${movie.language || 'Español'}`,
        quality: movie.quality || 'HD'
      });
    }
    console.log(`Movie streams found: ${streams.length}`);
  } else if (type === 'series') {
    // Para episodios de series: format id:season:episode
    const parts = id.split(':');
    console.log(`Episode ID parts:`, parts);
    
    if (parts.length === 3) {
      const [seriesId, season, episode] = parts;
      const seasonNum = parseInt(season);
      const episodeNum = parseInt(episode);
      
      console.log(`Looking for episode: seriesId=${seriesId}, season=${seasonNum}, episode=${episodeNum}`);
      
      const ep = contentDatabase.episodes.find(ep => 
        ep.seriesId === seriesId && 
        ep.season === seasonNum && 
        ep.episode === episodeNum
      );
      
      console.log(`Episode found:`, ep ? 'YES' : 'NO');
      
      if (ep && ep.url) {
        streams.push({
          url: ep.url,
          title: `${ep.quality || 'HD'} - ${ep.language || 'Español'}`,
          quality: ep.quality || 'HD'
        });
        console.log(`Episode stream added: ${ep.url}`);
      }
    }
    console.log(`Episode streams found: ${streams.length}`);
  }
  
  res.json({ streams });
});

// API para eliminar episodios específicos
app.delete('/api/delete/episode/:episodeId', async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    // Decodificar el ID del episodio (format: seriesId:season:episode)
    const [seriesId, season, episode] = episodeId.split(':');
    
    const index = contentDatabase.episodes.findIndex(ep => 
      ep.seriesId === seriesId && 
      ep.season === parseInt(season) && 
      ep.episode === parseInt(episode)
    );
    
    if (index !== -1) {
      contentDatabase.episodes.splice(index, 1);
      await saveDatabase(contentDatabase);
      res.json({ success: true, message: 'Episodio eliminado exitosamente' });
    } else {
      res.status(404).json({ error: 'Episodio no encontrado' });
    }
  } catch (error) {
    console.error('Error eliminando episodio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// API para agregar contenido
app.post('/api/add-movie', async (req, res) => {
  const movieData = req.body;
  
  try {
    // Validar datos requeridos
    if (!movieData.id || !movieData.name || !movieData.url) {
      return res.status(400).json({ error: 'ID, nombre y URL son requeridos' });
    }
    
    // Verificar si ya existe
    const exists = contentDatabase.movies.find(movie => movie.id === movieData.id);
    if (exists) {
      return res.status(409).json({ error: 'Película ya existe' });
    }
    
    const newMovie = {
      id: movieData.id,
      type: 'movie',
      name: movieData.name,
      genre: movieData.genre ? movieData.genre.split(',').map(g => g.trim()) : [],
      year: movieData.year,
      director: movieData.director ? movieData.director.split(',').map(d => d.trim()) : [],
      cast: movieData.cast ? movieData.cast.split(',').map(c => c.trim()) : [],
      description: movieData.description,
      poster: movieData.poster,
      background: movieData.background,
      runtime: movieData.runtime,
      logo: movieData.logo,
      imdbRating: movieData.imdbRating,
      url: movieData.url,
      quality: movieData.quality,
      language: movieData.language,
      dateAdded: new Date().toISOString()
    };
    
    contentDatabase.movies.push(newMovie);
    await saveDatabase(contentDatabase);
    
    console.log(`✅ Película agregada: ${newMovie.name} (${newMovie.id})`);
    res.json({ success: true, message: 'Película agregada exitosamente' });
  } catch (error) {
    console.error('Error agregando película:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/add-series', async (req, res) => {
  const seriesData = req.body;
  
  try {
    if (!seriesData.id || !seriesData.name) {
      return res.status(400).json({ error: 'ID y nombre son requeridos' });
    }
    
    const exists = contentDatabase.series.find(series => series.id === seriesData.id);
    if (exists) {
      return res.status(409).json({ error: 'Serie ya existe' });
    }
    
    const newSeries = {
      id: seriesData.id,
      type: 'series',
      name: seriesData.name,
      genre: seriesData.genre ? seriesData.genre.split(',').map(g => g.trim()) : [],
      year: seriesData.year,
      director: seriesData.director ? seriesData.director.split(',').map(d => d.trim()) : [],
      cast: seriesData.cast ? seriesData.cast.split(',').map(c => c.trim()) : [],
      description: seriesData.description,
      poster: seriesData.poster,
      background: seriesData.background,
      runtime: seriesData.runtime,
      logo: seriesData.logo,
      imdbRating: seriesData.imdbRating,
      dateAdded: new Date().toISOString()
    };
    
    contentDatabase.series.push(newSeries);
    await saveDatabase(contentDatabase);
    
    console.log(`✅ Serie agregada: ${newSeries.name} (${newSeries.id})`);
    res.json({ success: true, message: 'Serie agregada exitosamente' });
  } catch (error) {
    console.error('Error agregando serie:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/add-episode', async (req, res) => {
  const episodeData = req.body;
  
  try {
    if (!episodeData.seriesId || !episodeData.name || !episodeData.season || !episodeData.episode || !episodeData.url) {
      return res.status(400).json({ error: 'ID de serie, nombre, temporada, episodio y URL son requeridos' });
    }
    
    // Verificar que la serie existe
    const seriesExists = contentDatabase.series.find(series => series.id === episodeData.seriesId);
    if (!seriesExists) {
      return res.status(404).json({ error: 'Serie no encontrada' });
    }
    
    const episodeId = `${episodeData.seriesId}:${episodeData.season}:${episodeData.episode}`;
    const exists = contentDatabase.episodes.find(ep => 
      ep.seriesId === episodeData.seriesId && 
      ep.season === parseInt(episodeData.season) && 
      ep.episode === parseInt(episodeData.episode)
    );
    
    if (exists) {
      return res.status(409).json({ error: 'Episodio ya existe' });
    }
    
    const newEpisode = {
      id: episodeId,
      seriesId: episodeData.seriesId,
      name: episodeData.name,
      season: parseInt(episodeData.season),
      episode: parseInt(episodeData.episode),
      description: episodeData.description,
      poster: episodeData.poster,
      year: episodeData.year,
      runtime: episodeData.runtime,
      url: episodeData.url,
      quality: episodeData.quality,
      language: episodeData.language,
      dateAdded: new Date().toISOString()
    };
    
    contentDatabase.episodes.push(newEpisode);
    await saveDatabase(contentDatabase);
    
    console.log(`✅ Episodio agregado: ${seriesExists.name} T${newEpisode.season}E${newEpisode.episode} - ${newEpisode.name}`);
    res.json({ success: true, message: 'Episodio agregado exitosamente' });
  } catch (error) {
    console.error('Error agregando episodio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// API para obtener contenido
app.get('/api/content', (req, res) => {
  res.json(contentDatabase);
});

// API para obtener información del archivo de datos
app.get('/api/database-info', async (req, res) => {
  try {
    const stats = await fs.stat(DATA_FILE);
    const fileSize = (stats.size / 1024).toFixed(2); // KB
    
    res.json({
      filename: path.basename(DATA_FILE),
      filepath: DATA_FILE,
      fileSize: `${fileSize} KB`,
      lastModified: stats.mtime,
      totalItems: contentDatabase.movies.length + contentDatabase.series.length + contentDatabase.episodes.length,
      movies: contentDatabase.movies.length,
      series: contentDatabase.series.length,
      episodes: contentDatabase.episodes.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo información de la base de datos' });
  }
});

// API para descargar backup de la base de datos
app.get('/api/download-backup', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `content-backup-${timestamp}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(contentDatabase);
  } catch (error) {
    res.status(500).json({ error: 'Error creando backup' });
  }
});

// API para debug - obtener episodios de una serie específica
app.get('/api/debug/series/:seriesId/episodes', (req, res) => {
  const { seriesId } = req.params;
  const episodes = contentDatabase.episodes.filter(ep => ep.seriesId === seriesId);
  res.json({
    seriesId,
    episodeCount: episodes.length,
    episodes: episodes
  });
});

// API para debug - verificar meta de serie
app.get('/api/debug/meta/:seriesId', (req, res) => {
  const { seriesId } = req.params;
  const series = contentDatabase.series.find(s => s.id === seriesId);
  const episodes = contentDatabase.episodes.filter(ep => ep.seriesId === seriesId);
  
  if (!series) {
    return res.status(404).json({ error: 'Serie no encontrada' });
  }
  
  const videos = episodes.map(ep => ({
    id: `${seriesId}:${ep.season}:${ep.episode}`,
    title: `S${ep.season.toString().padStart(2, '0')}E${ep.episode.toString().padStart(2, '0')} - ${ep.name}`,
    season: ep.season,
    episode: ep.episode,
    overview: ep.description || '',
    thumbnail: ep.poster || series.poster,
    released: ep.year ? new Date(ep.year, 0, 1).toISOString() : new Date().toISOString()
  }));
  
  res.json({
    series,
    episodeCount: episodes.length,
    videos
  });
});

// API para eliminar contenido
app.delete('/api/delete/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  
  try {
    if (type === 'movie') {
      const index = contentDatabase.movies.findIndex(movie => movie.id === id);
      if (index !== -1) {
        const deletedMovie = contentDatabase.movies.splice(index, 1)[0];
        await saveDatabase(contentDatabase);
        console.log(`🗑️ Película eliminada: ${deletedMovie.name}`);
        res.json({ success: true, message: 'Película eliminada exitosamente' });
      } else {
        res.status(404).json({ error: 'Película no encontrada' });
      }
    } else if (type === 'series') {
      const index = contentDatabase.series.findIndex(series => series.id === id);
      if (index !== -1) {
        const deletedSeries = contentDatabase.series.splice(index, 1)[0];
        // También eliminar episodios relacionados
        const episodesBefore = contentDatabase.episodes.length;
        contentDatabase.episodes = contentDatabase.episodes.filter(ep => ep.seriesId !== id);
        const episodesDeleted = episodesBefore - contentDatabase.episodes.length;
        
        await saveDatabase(contentDatabase);
        console.log(`🗑️ Serie eliminada: ${deletedSeries.name} (incluyendo ${episodesDeleted} episodios)`);
        res.json({ success: true, message: `Serie eliminada exitosamente (incluyendo ${episodesDeleted} episodios)` });
      } else {
        res.status(404).json({ error: 'Serie no encontrada' });
      }
    } else {
      res.status(400).json({ error: 'Tipo no válido' });
    }
  } catch (error) {
    console.error('Error eliminando contenido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialización del servidor
async function startServer() {
  try {
    // Cargar la base de datos
    contentDatabase = await loadDatabase();
    
    // Iniciar el servidor
    app.listen(PORT, () => {
      console.log('\n🚀 ====================================');
      console.log(`🎬 Stremio Addon corriendo en puerto ${PORT}`);
      console.log(`📋 Manifiesto: http://localhost:${PORT}/manifest.json`);
      console.log(`🖥️  Panel Admin: http://localhost:${PORT}/`);
      console.log(`💾 Base de datos: ${DATA_FILE}`);
      console.log('🚀 ====================================\n');
    });
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
}

// Manejar cierre del servidor
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  try {
    await saveDatabase(contentDatabase);
    console.log('💾 Base de datos guardada antes del cierre');
  } catch (error) {
    console.error('❌ Error guardando base de datos:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Servidor terminado...');
  try {
    await saveDatabase(contentDatabase);
    console.log('💾 Base de datos guardada antes del cierre');
  } catch (error) {
    console.error('❌ Error guardando base de datos:', error);
  }
  process.exit(0);
});

// Iniciar el servidor
startServer();
