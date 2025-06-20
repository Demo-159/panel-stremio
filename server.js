const express = require("express");
const cors = require("cors");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

// Configuración de Cloudflare CDN
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CDN_DOMAIN = process.env.CDN_DOMAIN || "cdn.tudominio.com"; // Tu subdominio CDN

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const GITHUB_FILES = {
    movies: "data/movies.json",
    series: "data/series.json",
    episodes: "data/episodes.json"
};

let contentDatabase = {
    movies: [],
    series: [],
    episodes: []
};
let fileSHAs = {};

// Cache para URLs convertidas
let cdnUrlCache = new Map();

const addonConfig = {
    id: "com.tudominio.myaddon",
    version: "1.0.0",
    name: "Reproducir ahora",
    description: "Contenido en Español Latino con CDN optimizado",
    logo: "https://via.placeholder.com/200x200.png?text=Mi+Addon",
    background: "https://via.placeholder.com/1920x1080.png?text=Background",
    types: ["movie", "series"],
    catalogs: [
        { type: "movie", id: "my-movies", name: "Recomendación" },
        { type: "series", id: "my-series", name: "Recomendación" }
    ],
    resources: ["catalog", "meta", "stream"],
    idPrefixes: ["tt", "custom"]
};

// Función para generar hash único de URL
function generateUrlHash(url) {
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

// Función para convertir URL a CDN de Cloudflare
function convertToCdnUrl(originalUrl) {
    if (!originalUrl) return originalUrl;
    
    // Si ya está en cache, devolver URL cacheada
    if (cdnUrlCache.has(originalUrl)) {
        return cdnUrlCache.get(originalUrl);
    }
    
    try {
        const urlObj = new URL(originalUrl);
        const hash = generateUrlHash(originalUrl);
        const extension = path.extname(urlObj.pathname) || '.mp4';
        
        // Crear URL optimizada con CDN de Cloudflare
        const cdnUrl = `https://${CDN_DOMAIN}/video/${hash}${extension}?origin=${encodeURIComponent(originalUrl)}`;
        
        // Guardar en cache
        cdnUrlCache.set(originalUrl, cdnUrl);
        
        console.log(`🔄 URL convertida a CDN: ${originalUrl} -> ${cdnUrl}`);
        return cdnUrl;
    } catch (error) {
        console.error(`❌ Error convirtiendo URL a CDN: ${error.message}`);
        return originalUrl; // Devolver URL original si hay error
    }
}

// Función para procesar contenido y convertir URLs a CDN
function processContentForCdn(content) {
    if (Array.isArray(content)) {
        return content.map(item => processContentForCdn(item));
    }
    
    if (typeof content === 'object' && content !== null) {
        const processed = { ...content };
        
        // Convertir URL principal si existe
        if (processed.url) {
            processed.url = convertToCdnUrl(processed.url);
        }
        
        // Convertir URLs adicionales si existen
        if (processed.urls && Array.isArray(processed.urls)) {
            processed.urls = processed.urls.map(urlItem => ({
                ...urlItem,
                url: convertToCdnUrl(urlItem.url)
            }));
        }
        
        return processed;
    }
    
    return content;
}

// Función para crear regla de Page Rule en Cloudflare (opcional)
async function createCloudflarePageRule(pattern) {
    if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_API_TOKEN) {
        console.log("⚠️ Cloudflare no configurado, usando URLs directas");
        return false;
    }
    
    try {
        const options = {
            hostname: 'api.cloudflare.com',
            port: 443,
            path: `/client/v4/zones/${CLOUDFLARE_ZONE_ID}/pagerules`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        
        const data = {
            targets: [{ target: 'url', constraint: { operator: 'matches', value: pattern } }],
            actions: [
                { id: 'cache_level', value: 'cache_everything' },
                { id: 'edge_cache_ttl', value: 86400 }, // 24 horas
                { id: 'browser_cache_ttl', value: 3600 }  // 1 hora
            ],
            priority: 1,
            status: 'active'
        };
        
        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        if (result.success) {
                            console.log(`✅ Page Rule creada en Cloudflare: ${pattern}`);
                            resolve(true);
                        } else {
                            console.log(`⚠️ No se pudo crear Page Rule: ${result.errors?.[0]?.message || 'Error desconocido'}`);
                            resolve(false);
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.write(JSON.stringify(data));
            req.end();
        });
    } catch (error) {
        console.error(`❌ Error creando Page Rule: ${error.message}`);
        return false;
    }
}

function githubRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Stremio-Addon',
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    const result = responseData ? JSON.parse(responseData) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(result);
                    } else {
                        reject(new Error(`GitHub API Error: ${res.statusCode} - ${result.message || responseData}`));
                    }
                } catch (error) {
                    reject(new Error(`JSON Parse Error: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => { reject(error); });
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function readFromGitHub(filename) {
    try {
        const path = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
        console.log(`Leyendo desde GitHub: ${path}`);
        
        const response = await githubRequest('GET', path);
        fileSHAs[filename] = response.sha;
        
        const content = Buffer.from(response.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.log(`Archivo ${filename} no existe en GitHub, creando uno vacío`);
        await writeToGitHub(filename, []);
        return [];
    }
}

async function writeToGitHub(filename, data) {
    try {
        const content = Buffer.from(JSON.stringify(data)).toString('base64');
        const path = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filename}`;
        
        const requestData = {
            message: `Update ${filename}`,
            content: content,
            branch: GITHUB_BRANCH
        };
        
        if (fileSHAs[filename]) {
            requestData.sha = fileSHAs[filename];
        }
        
        console.log(`Escribiendo a GitHub: ${path}`);
        const response = await githubRequest('PUT', path, requestData);
        fileSHAs[filename] = response.content.sha;
        
        console.log(`✅ Archivo ${filename} guardado en GitHub (minificado)`);
        return response;
    } catch (error) {
        console.error(`❌ Error guardando ${filename} en GitHub:`, error.message);
        throw error;
    }
}

async function loadAllDataFromGitHub() {
    console.log("🔄 Cargando datos desde GitHub...");
    
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
        console.error("❌ Configuración de GitHub incompleta. Verifica las variables de entorno:");
        console.error("GITHUB_TOKEN:", GITHUB_TOKEN ? "✅ Configurado" : "❌ Falta");
        console.error("GITHUB_OWNER:", GITHUB_OWNER ? "✅ Configurado" : "❌ Falta");
        console.error("GITHUB_REPO:", GITHUB_REPO ? "✅ Configurado" : "❌ Falta");
        contentDatabase = { movies: [], series: [], episodes: [] };
        return;
    }
    
    try {
        contentDatabase.movies = await readFromGitHub(GITHUB_FILES.movies);
        contentDatabase.series = await readFromGitHub(GITHUB_FILES.series);
        contentDatabase.episodes = await readFromGitHub(GITHUB_FILES.episodes);
        
        console.log(`✅ Datos cargados desde GitHub: ${contentDatabase.movies.length} películas, ${contentDatabase.series.length} series, ${contentDatabase.episodes.length} episodios`);
    } catch (error) {
        console.error("❌ Error cargando datos desde GitHub:", error.message);
        contentDatabase = { movies: [], series: [], episodes: [] };
    }
}

async function saveMoviesToGitHub() {
    await writeToGitHub(GITHUB_FILES.movies, contentDatabase.movies);
}

async function saveSeriesToGitHub() {
    await writeToGitHub(GITHUB_FILES.series, contentDatabase.series);
}

async function saveEpisodesToGitHub() {
    await writeToGitHub(GITHUB_FILES.episodes, contentDatabase.episodes);
}

// Inicializar datos
loadAllDataFromGitHub();

// Crear Page Rule inicial para el patrón de CDN
setTimeout(() => {
    createCloudflarePageRule(`${CDN_DOMAIN}/video/*`);
}, 5000);

// Rutas de la API
app.get("/manifest.json", (req, res) => {
    res.json(addonConfig);
});

app.get("/catalog/:type/:id.json", (req, res) => {
    const { type, id } = req.params;
    let metas = [];
    
    if (type === "movie" && id === "my-movies") {
        metas = contentDatabase.movies.map(movie => ({
            id: movie.id,
            type: "movie",
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
    } else if (type === "series" && id === "my-series") {
        metas = contentDatabase.series.map(series => ({
            id: series.id,
            type: "series",
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

app.get("/meta/:type/:id.json", (req, res) => {
    const { type, id } = req.params;
    let meta = null;
    
    if (type === "movie") {
        meta = contentDatabase.movies.find(movie => movie.id === id);
    } else if (type === "series") {
        const series = contentDatabase.series.find(s => s.id === id);
        if (series) {
            const episodes = contentDatabase.episodes.filter(ep => ep.seriesId === id);
            episodes.sort((a, b) => a.season !== b.season ? a.season - b.season : a.episode - b.episode);
            
            const videos = episodes.map(episode => ({
                id: `${id}:${episode.season}:${episode.episode}`,
                title: `S${episode.season.toString().padStart(2, '0')}E${episode.episode.toString().padStart(2, '0')} - ${episode.name}`,
                season: episode.season,
                episode: episode.episode,
                overview: episode.description || "",
                thumbnail: episode.poster || series.poster,
                released: episode.year ? new Date(episode.year, 0, 1).toISOString() : new Date().toISOString(),
                runtime: episode.runtime || series.runtime
            }));
            
            meta = { ...series, videos };
        }
    }
    
    if (meta) {
        res.json({ meta });
    } else {
        res.status(404).json({ error: "Content not found" });
    }
});

app.get("/stream/:type/:id.json", (req, res) => {
    const { type, id } = req.params;
    console.log(`Stream request: type=${type}, id=${id}`);
    
    let streams = [];
    
    if (type === "movie") {
        const movie = contentDatabase.movies.find(m => m.id === id);
        if (movie && movie.url) {
            // Convertir URL a CDN automáticamente
            const cdnUrl = convertToCdnUrl(movie.url);
            streams.push({
                url: cdnUrl,
                title: `${movie.quality || "HD"} - ${movie.language || "Español"} (CDN Optimizado)`,
                quality: movie.quality || "HD"
            });
        }
        console.log(`Movie streams found: ${streams.length}`);
    } else if (type === "series") {
        const parts = id.split(":");
        console.log("Episode ID parts:", parts);
        
        if (parts.length === 3) {
            const [seriesId, season, episode] = parts;
            const seasonNum = parseInt(season);
            const episodeNum = parseInt(episode);
            
            console.log(`Looking for episode: seriesId=${seriesId}, season=${seasonNum}, episode=${episodeNum}`);
            
            const episodeData = contentDatabase.episodes.find(ep => 
                ep.seriesId === seriesId && 
                ep.season === seasonNum && 
                ep.episode === episodeNum
            );
            
            console.log("Episode found:", episodeData ? "YES" : "NO");
            
            if (episodeData && episodeData.url) {
                // Convertir URL a CDN automáticamente
                const cdnUrl = convertToCdnUrl(episodeData.url);
                streams.push({
                    url: cdnUrl,
                    title: `${episodeData.quality || "HD"} - ${episodeData.language || "Español"} (CDN Optimizado)`,
                    quality: episodeData.quality || "HD"
                });
                console.log(`Episode stream added with CDN: ${cdnUrl}`);
            }
        }
        console.log(`Episode streams found: ${streams.length}`);
    }
    
    res.json({ streams });
});

// API endpoints existentes...
app.post("/api/add-movie", async (req, res) => {
    const movieData = req.body;
    
    if (!movieData.id || !movieData.name || !movieData.url) {
        return res.status(400).json({ error: "ID, nombre y URL son requeridos" });
    }
    
    const existingMovie = contentDatabase.movies.find(movie => movie.id === movieData.id);
    if (existingMovie) {
        return res.status(409).json({ error: "Película ya existe" });
    }
    
    const newMovie = {
        id: movieData.id,
        type: "movie",
        name: movieData.name,
        genre: movieData.genre ? movieData.genre.split(",").map(g => g.trim()) : [],
        year: movieData.year,
        director: movieData.director ? movieData.director.split(",").map(d => d.trim()) : [],
        cast: movieData.cast ? movieData.cast.split(",").map(c => c.trim()) : [],
        description: movieData.description,
        poster: movieData.poster,
        background: movieData.background,
        runtime: movieData.runtime,
        logo: movieData.logo,
        imdbRating: movieData.imdbRating,
        url: movieData.url, // Se convertirá a CDN al hacer stream
        quality: movieData.quality,
        language: movieData.language,
        dateAdded: new Date().toISOString()
    };
    
    contentDatabase.movies.push(newMovie);
    
    try {
        await saveMoviesToGitHub();
        console.log(`🎬 Nueva película agregada: ${newMovie.name} (URL: ${newMovie.url})`);
        res.json({ success: true, message: "Película agregada y guardada en GitHub exitosamente" });
    } catch (error) {
        contentDatabase.movies.pop();
        res.status(500).json({ error: "Error guardando en GitHub: " + error.message });
    }
});

app.post("/api/add-episode", async (req, res) => {
    const episodeData = req.body;
    
    if (!episodeData.seriesId || !episodeData.name || !episodeData.season || !episodeData.episode || !episodeData.url) {
        return res.status(400).json({ error: "ID de serie, nombre, temporada, episodio y URL son requeridos" });
    }
    
    const series = contentDatabase.series.find(s => s.id === episodeData.seriesId);
    if (!series) {
        return res.status(404).json({ error: "Serie no encontrada" });
    }
    
    const episodeId = `${episodeData.seriesId}:${episodeData.season}:${episodeData.episode}`;
    const existingEpisode = contentDatabase.episodes.find(ep => 
        ep.seriesId === episodeData.seriesId && 
        ep.season === parseInt(episodeData.season) && 
        ep.episode === parseInt(episodeData.episode)
    );
    
    if (existingEpisode) {
        return res.status(409).json({ error: "Episodio ya existe" });
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
        url: episodeData.url, // Se convertirá a CDN al hacer stream
        quality: episodeData.quality,
        language: episodeData.language,
        dateAdded: new Date().toISOString()
    };
    
    contentDatabase.episodes.push(newEpisode);
    
    try {
        await saveEpisodesToGitHub();
        console.log(`📺 Nuevo episodio agregado: ${newEpisode.name} (URL: ${newEpisode.url})`);
        res.json({ success: true, message: "Episodio agregado y guardado en GitHub exitosamente" });
    } catch (error) {
        contentDatabase.episodes.pop();
        res.status(500).json({ error: "Error guardando en GitHub: " + error.message });
    }
});

// Resto de endpoints existentes...
app.post("/api/add-series", async (req, res) => {
    const seriesData = req.body;
    
    if (!seriesData.id || !seriesData.name) {
        return res.status(400).json({ error: "ID y nombre son requeridos" });
    }
    
    const existingSeries = contentDatabase.series.find(series => series.id === seriesData.id);
    if (existingSeries) {
        return res.status(409).json({ error: "Serie ya existe" });
    }
    
    const newSeries = {
        id: seriesData.id,
        type: "series",
        name: seriesData.name,
        genre: seriesData.genre ? seriesData.genre.split(",").map(g => g.trim()) : [],
        year: seriesData.year,
        director: seriesData.director ? seriesData.director.split(",").map(d => d.trim()) : [],
        cast: seriesData.cast ? seriesData.cast.split(",").map(c => c.trim()) : [],
        description: seriesData.description,
        poster: seriesData.poster,
        background: seriesData.background,
        runtime: seriesData.runtime,
        logo: seriesData.logo,
        imdbRating: seriesData.imdbRating,
        dateAdded: new Date().toISOString()
    };
    
    contentDatabase.series.push(newSeries);
    
    try {
        await saveSeriesToGitHub();
        res.json({ success: true, message: "Serie agregada y guardada en GitHub exitosamente" });
    } catch (error) {
        contentDatabase.series.pop();
        res.status(500).json({ error: "Error guardando en GitHub: " + error.message });
    }
});

// Endpoint para limpiar cache de CDN
app.post("/api/cdn/clear-cache", (req, res) => {
    cdnUrlCache.clear();
    console.log("🧹 Cache de URLs CDN limpiado");
    res.json({ success: true, message: "Cache de CDN limpiado exitosamente" });
});

// Endpoint para ver estadísticas de CDN
app.get("/api/cdn/stats", (req, res) => {
    res.json({
        cdnDomain: CDN_DOMAIN,
        cachedUrls: cdnUrlCache.size,
        cloudflareConfigured: !!(CLOUDFLARE_ZONE_ID && CLOUDFLARE_API_TOKEN),
        cacheEntries: Array.from(cdnUrlCache.entries()).map(([original, cdn]) => ({
            original: original.substring(0, 50) + "...",
            cdn: cdn.substring(0, 50) + "..."
        }))
    });
});

// Endpoints existentes del addon original...
app.get("/api/content", (req, res) => {
    res.json(contentDatabase);
});

app.delete("/api/delete/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    
    if (type === "movie") {
        const movieIndex = contentDatabase.movies.findIndex(movie => movie.id === id);
        if (movieIndex !== -1) {
            contentDatabase.movies.splice(movieIndex, 1);
            try {
                await saveMoviesToGitHub();
                res.json({ success: true, message: "Película eliminada y guardada en GitHub" });
            } catch (error) {
                res.status(500).json({ error: "Error guardando en GitHub: " + error.message });
            }
        } else {
            res.status(404).json({ error: "Película no encontrada" });
        }
    } else if (type === "series") {
        const seriesIndex = contentDatabase.series.findIndex(series => series.id === id);
        if (seriesIndex !== -1) {
            contentDatabase.series.splice(seriesIndex, 1);
            contentDatabase.episodes = contentDatabase.episodes.filter(ep => ep.seriesId !== id);
            try {
                await saveSeriesToGitHub();
                await saveEpisodesToGitHub();
                res.json({ success: true, message: "Serie eliminada y guardada en GitHub" });
            } catch (error) {
                res.status(500).json({ error: "Error guardando en GitHub: " + error.message });
            }
        } else {
            res.status(404).json({ error: "Serie no encontrada" });
        }
    } else {
        res.status(400).json({ error: "Tipo no válido" });
    }
});

app.post("/api/reload-data", async (req, res) => {
    try {
        await loadAllDataFromGitHub();
        res.json({ success: true, message: "Datos recargados desde GitHub" });
    } catch (error) {
        res.status(500).json({ error: "Error al recargar datos desde GitHub: " + error.message });
    }
});

app.get("/api/github-status", (req, res) => {
    res.json({
        configured: !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO),
        owner: GITHUB_OWNER || "No configurado",
        repo: GITHUB_REPO || "No configurado",
        branch: GITHUB_BRANCH,
        files: GITHUB_FILES,
        cdnConfigured: !!(CLOUDFLARE_ZONE_ID && CLOUDFLARE_API_TOKEN),
        cdnDomain: CDN_DOMAIN
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`🚀 Stremio Addon corriendo en puerto ${PORT}`);
    console.log(`📄 Manifiesto disponible en: http://localhost:${PORT}/manifest.json`);
    console.log(`🎛️ Panel de administración en: http://localhost:${PORT}/`);
    
    if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
        console.log(`📂 Almacenamiento en GitHub: ${GITHUB_OWNER}/${GITHUB_REPO}`);
        console.log(`🌿 Rama: ${GITHUB_BRANCH}`);
    } else {
        console.log("⚠️ Configuración de GitHub incompleta - usando almacenamiento local");
    }
    
    if (CLOUDFLARE_ZONE_ID && CLOUDFLARE_API_TOKEN) {
        console.log(`🌐 CDN de Cloudflare configurado: ${CDN_DOMAIN}`);
    } else {
        console.log(`🌐 CDN básico configurado: ${CDN_DOMAIN} (sin optimización Cloudflare)`);
    }
});
