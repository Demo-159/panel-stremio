// tmdb-api.js - Cliente para TMDB API
// Guarda este archivo como tmdb-api.js en la misma carpeta que tu HTML

class TMDBClient {
    constructor() {
        // API Key gratuita de TMDB (puedes obtener una en https://www.themoviedb.org/settings/api)
        this.apiKey = 'ed52d6c5a797006699cdcc63ed1208d5'; // Reemplaza con tu API key de TMDB
        this.baseURL = 'https://api.themoviedb.org/3';
        this.imageBaseURL = 'https://image.tmdb.org/t/p/w500';
        this.backdropBaseURL = 'https://image.tmdb.org/t/p/w1280';
    }

    // Configurar API Key
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    // Buscar por ID de IMDB
    async searchByIMDB(imdbId) {
        if (!this.apiKey) {
            throw new Error('API Key de TMDB no configurada');
        }

        try {
            const response = await fetch(
                `${this.baseURL}/find/${imdbId}?api_key=${this.apiKey}&external_source=imdb_id&language=es-MX`
            );

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            // Determinar si es película o serie
            if (data.movie_results && data.movie_results.length > 0) {
                return await this.getMovieDetails(data.movie_results[0].id);
            } else if (data.tv_results && data.tv_results.length > 0) {
                return await this.getTVDetails(data.tv_results[0].id);
            } else {
                throw new Error('No se encontró contenido con ese ID de IMDB');
            }
        } catch (error) {
            console.error('Error buscando en TMDB:', error);
            throw error;
        }
    }

    // Obtener detalles de película
    async getMovieDetails(movieId) {
        const response = await fetch(
            `${this.baseURL}/movie/${movieId}?api_key=${this.apiKey}&language=es-MX&append_to_response=credits`
        );

        if (!response.ok) {
            throw new Error(`Error obteniendo detalles de película: ${response.status}`);
        }

        const movie = await response.json();

        return {
            type: 'movie',
            name: movie.title,
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
            runtime: movie.runtime,
            genre: movie.genres.map(g => g.name).join(', '),
            director: movie.credits.crew
                .filter(person => person.job === 'Director')
                .map(person => person.name)
                .join(', '),
            cast: movie.credits.cast
                .slice(0, 5)
                .map(person => person.name)
                .join(', '),
            imdbRating: movie.vote_average,
            poster: movie.poster_path ? `${this.imageBaseURL}${movie.poster_path}` : '',
            background: movie.backdrop_path ? `${this.backdropBaseURL}${movie.backdrop_path}` : '',
            description: movie.overview
        };
    }

    // Obtener detalles de serie
    async getTVDetails(tvId) {
        const response = await fetch(
            `${this.baseURL}/tv/${tvId}?api_key=${this.apiKey}&language=es-MX&append_to_response=credits`
        );

        if (!response.ok) {
            throw new Error(`Error obteniendo detalles de serie: ${response.status}`);
        }

        const tv = await response.json();

        return {
            type: 'tv',
            name: tv.name,
            year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : null,
            runtime: tv.episode_run_time && tv.episode_run_time.length > 0 ? tv.episode_run_time[0] : null,
            genre: tv.genres.map(g => g.name).join(', '),
            director: tv.created_by.map(person => person.name).join(', '),
            cast: tv.credits.cast
                .slice(0, 5)
                .map(person => person.name)
                .join(', '),
            imdbRating: tv.vote_average,
            poster: tv.poster_path ? `${this.imageBaseURL}${tv.poster_path}` : '',
            background: tv.backdrop_path ? `${this.backdropBaseURL}${tv.backdrop_path}` : '',
            description: tv.overview
        };
    }

    // Obtener detalles de episodio específico
    async getEpisodeDetails(tvId, seasonNumber, episodeNumber) {
        const response = await fetch(
            `${this.baseURL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${this.apiKey}&language=es-MX`
        );

        if (!response.ok) {
            throw new Error(`Error obteniendo detalles de episodio: ${response.status}`);
        }

        const episode = await response.json();

        return {
            name: episode.name,
            description: episode.overview,
            runtime: episode.runtime,
            poster: episode.still_path ? `${this.imageBaseURL}${episode.still_path}` : '',
            year: episode.air_date ? new Date(episode.air_date).getFullYear() : null
        };
    }
}

// Instancia global
window.tmdbClient = new TMDBClient();