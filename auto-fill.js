// auto-fill.js - Manejo del autocompletado
// Guarda este archivo como auto-fill.js en la misma carpeta que tu HTML

// Configuración de la API Key de TMDB
const TMDB_API_KEY = ''; // Coloca aquí tu API key de TMDB

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    // Configurar API key
    if (TMDB_API_KEY) {
        window.tmdbClient.setApiKey(TMDB_API_KEY);
    }
    
    // Configurar event listeners para autocompletado
    setupAutoFillListeners();
});

// Configurar listeners para autocompletado
function setupAutoFillListeners() {
    // Autocompletado para películas
    const movieIdInput = document.getElementById('movieId');
    if (movieIdInput) {
        movieIdInput.addEventListener('blur', handleMovieAutoFill);
        
        // Agregar botón de autocompletado
        addAutoFillButton(movieIdInput, 'movie');
    }
    
    // Autocompletado para series
    const seriesIdInput = document.getElementById('seriesId');
    if (seriesIdInput) {
        seriesIdInput.addEventListener('blur', handleSeriesAutoFill);
        
        // Agregar botón de autocompletado
        addAutoFillButton(seriesIdInput, 'series');
    }
}

// Agregar botón de autocompletado
function addAutoFillButton(input, type) {
    const container = input.parentElement;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'auto-fill-btn';
    button.innerHTML = '🔄 Autocompletar';
    button.style.cssText = `
        margin-top: 5px;
        padding: 5px 10px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    `;
    
    button.addEventListener('click', () => {
        if (type === 'movie') {
            handleMovieAutoFill();
        } else if (type === 'series') {
            handleSeriesAutoFill();
        }
    });
    
    container.appendChild(button);
}

// Manejar autocompletado de películas
async function handleMovieAutoFill() {
    const imdbId = document.getElementById('movieId').value.trim();
    
    if (!imdbId || !imdbId.startsWith('tt')) {
        return;
    }
    
    if (!TMDB_API_KEY) {
        showAutoFillMessage('⚠️ API Key de TMDB no configurada. Edita auto-fill.js y agrega tu API key.', 'warning');
        return;
    }
    
    try {
        showAutoFillMessage('🔄 Buscando información...', 'info');
        
        const movieData = await window.tmdbClient.searchByIMDB(imdbId);
        
        if (movieData.type !== 'movie') {
            showAutoFillMessage('❌ El ID corresponde a una serie, no a una película', 'error');
            return;
        }
        
        // Rellenar campos solo si están vacíos
        fillFieldIfEmpty('movieName', movieData.name);
        fillFieldIfEmpty('movieYear', movieData.year);
        fillFieldIfEmpty('movieRuntime', movieData.runtime);
        fillFieldIfEmpty('movieGenre', movieData.genre);
        fillFieldIfEmpty('movieDirector', movieData.director);
        fillFieldIfEmpty('movieCast', movieData.cast);
        fillFieldIfEmpty('movieRating', movieData.imdbRating?.toFixed(1));
        fillFieldIfEmpty('moviePoster', movieData.poster);
        fillFieldIfEmpty('movieBackground', movieData.background);
        fillFieldIfEmpty('movieDescription', movieData.description);
        
        showAutoFillMessage('✅ Información cargada desde TMDB', 'success');
        
    } catch (error) {
        console.error('Error en autocompletado de película:', error);
        showAutoFillMessage(`❌ Error: ${error.message}`, 'error');
    }
}

// Manejar autocompletado de series
async function handleSeriesAutoFill() {
    const imdbId = document.getElementById('seriesId').value.trim();
    
    if (!imdbId || !imdbId.startsWith('tt')) {
        return;
    }
    
    if (!TMDB_API_KEY) {
        showAutoFillMessage('⚠️ API Key de TMDB no configurada. Edita auto-fill.js y agrega tu API key.', 'warning');
        return;
    }
    
    try {
        showAutoFillMessage('🔄 Buscando información...', 'info');
        
        const seriesData = await window.tmdbClient.searchByIMDB(imdbId);
        
        if (seriesData.type !== 'tv') {
            showAutoFillMessage('❌ El ID corresponde a una película, no a una serie', 'error');
            return;
        }
        
        // Rellenar campos solo si están vacíos
        fillFieldIfEmpty('seriesName', seriesData.name);
        fillFieldIfEmpty('seriesYear', seriesData.year);
        fillFieldIfEmpty('seriesRuntime', seriesData.runtime);
        fillFieldIfEmpty('seriesGenre', seriesData.genre);
        fillFieldIfEmpty('seriesDirector', seriesData.director);
        fillFieldIfEmpty('seriesCast', seriesData.cast);
        fillFieldIfEmpty('seriesRating', seriesData.imdbRating?.toFixed(1));
        fillFieldIfEmpty('seriesPoster', seriesData.poster);
        fillFieldIfEmpty('seriesBackground', seriesData.background);
        fillFieldIfEmpty('seriesDescription', seriesData.description);
        
        showAutoFillMessage('✅ Información cargada desde TMDB', 'success');
        
    } catch (error) {
        console.error('Error en autocompletado de serie:', error);
        showAutoFillMessage(`❌ Error: ${error.message}`, 'error');
    }
}

// Rellenar campo solo si está vacío
function fillFieldIfEmpty(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field && !field.value && value) {
        field.value = value;
        
        // Agregar animación visual
        field.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            field.style.backgroundColor = '';
        }, 1000);
    }
}

// Mostrar mensaje de autocompletado
function showAutoFillMessage(message, type) {
    // Remover mensaje anterior si existe
    const existingMessage = document.querySelector('.auto-fill-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'auto-fill-message';
    messageDiv.textContent = message;
    
    const colors = {
        success: '#d4edda',
        error: '#f8d7da',
        warning: '#fff3cd',
        info: '#d1ecf1'
    };
    
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        padding: 10px 15px;
        border-radius: 5px;
        border-left: 4px solid ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        z-index: 10000;
        font-size: 14px;
        max-width: 300px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(messageDiv);
    
    // Remover mensaje después de 4 segundos
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 4000);
}

// Función para validar ID de IMDB
function isValidIMDBId(id) {
    return /^tt\d{7,}$/.test(id);
}

// Función para obtener API key desde input (opcional)
function updateApiKey() {
    const apiKeyInput = document.getElementById('tmdbApiKey');
    if (apiKeyInput && apiKeyInput.value.trim()) {
        window.tmdbClient.setApiKey(apiKeyInput.value.trim());
        localStorage.setItem('tmdb_api_key', apiKeyInput.value.trim());
        showAutoFillMessage('✅ API Key actualizada', 'success');
    }
}

// Cargar API key guardada (si existe)
document.addEventListener('DOMContentLoaded', function() {
    const savedApiKey = localStorage.getItem('tmdb_api_key');
    if (savedApiKey && !TMDB_API_KEY) {
        window.tmdbClient.setApiKey(savedApiKey);
    }
});