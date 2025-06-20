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

// Almacenamiento en memoria (en producción, usar base de datos)
let contentDatabase = {
  movies: [],
  series: [],
  episodes: []
};

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
app.delete('/api/delete/episode/:episodeId', (req, res) => {
  const { episodeId } = req.params;
  
  // Decodificar el ID del episodio (format: seriesId:season:episode)
  const [seriesId, season, episode] = episodeId.split(':');
  
  const index = contentDatabase.episodes.findIndex(ep => 
    ep.seriesId === seriesId && 
    ep.season === parseInt(season) && 
    ep.episode === parseInt(episode)
  );
  
  if (index !== -1) {
    contentDatabase.episodes.splice(index, 1);
    res.json({ success: true, message: 'Episodio eliminado' });
  } else {
    res.status(404).json({ error: 'Episodio no encontrado' });
  }
});

// API para agregar contenido
app.post('/api/add-movie', (req, res) => {
  const movieData = req.body;
  
  // Validar datos requeridos
  if (!movieData.id || !movieData.name || !movieData.url) {
    return res.status(400).json({ error: 'ID, nombre y URL son requeridos' });
  }
  
  // Verificar si ya existe
  const exists = contentDatabase.movies.find(movie => movie.id === movieData.id);
  if (exists) {
    return res.status(409).json({ error: 'Película ya existe' });
  }
  
  contentDatabase.movies.push({
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
    language: movieData.language
  });
  
  res.json({ success: true, message: 'Película agregada exitosamente' });
});

app.post('/api/add-series', (req, res) => {
  const seriesData = req.body;
  
  if (!seriesData.id || !seriesData.name) {
    return res.status(400).json({ error: 'ID y nombre son requeridos' });
  }
  
  const exists = contentDatabase.series.find(series => series.id === seriesData.id);
  if (exists) {
    return res.status(409).json({ error: 'Serie ya existe' });
  }
  
  contentDatabase.series.push({
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
    imdbRating: seriesData.imdbRating
  });
  
  res.json({ success: true, message: 'Serie agregada exitosamente' });
});

app.post('/api/add-episode', (req, res) => {
  const episodeData = req.body;
  
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
  
  contentDatabase.episodes.push({
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
    language: episodeData.language
  });
  
  res.json({ success: true, message: 'Episodio agregado exitosamente' });
});

// API para obtener contenido
app.get('/api/content', (req, res) => {
  res.json(contentDatabase);
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
app.delete('/api/delete/:type/:id', (req, res) => {
  const { type, id } = req.params;
  
  if (type === 'movie') {
    const index = contentDatabase.movies.findIndex(movie => movie.id === id);
    if (index !== -1) {
      contentDatabase.movies.splice(index, 1);
      res.json({ success: true, message: 'Película eliminada' });
    } else {
      res.status(404).json({ error: 'Película no encontrada' });
    }
  } else if (type === 'series') {
    const index = contentDatabase.series.findIndex(series => series.id === id);
    if (index !== -1) {
      contentDatabase.series.splice(index, 1);
      // También eliminar episodios relacionados
      contentDatabase.episodes = contentDatabase.episodes.filter(ep => ep.seriesId !== id);
      res.json({ success: true, message: 'Serie eliminada' });
    } else {
      res.status(404).json({ error: 'Serie no encontrada' });
    }
  } else {
    res.status(400).json({ error: 'Tipo no válido' });
  }
});

// Servir el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Stremio Addon corriendo en puerto ${PORT}`);
  console.log(`Manifiesto disponible en: http://localhost:${PORT}/manifest.json`);
  console.log(`Panel de administración en: http://localhost:${PORT}/`);
});
