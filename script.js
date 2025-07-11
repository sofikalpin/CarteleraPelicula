const BACKEND_URL = 'http://localhost:3000/api';

const loadMoviesBtn = document.getElementById('loadMoviesBtn');
const viewDataBtn = document.getElementById('viewDataBtn');
const citySelect = document.getElementById('citySelect');

const statusMessagesContainer = document.getElementById('statusMessagesContainer');
const loadStatus = document.getElementById('loadStatus');
const noMoviesMessage = document.getElementById('noMoviesMessage');

const moviesContainer = document.getElementById('moviesContainer');
const averageRatingElement = document.getElementById('averageRating');

function showStatusMessage(elementToShow, message, color = null) {
    loadStatus.style.display = 'none';
    noMoviesMessage.style.display = 'none';
    loadStatus.textContent = ''; 
    noMoviesMessage.textContent = ''; 

    if (elementToShow) {
        elementToShow.textContent = message;
        elementToShow.style.display = 'block';
        if (color) {
            elementToShow.style.color = color;
        }
    }
}

function VisualizarDatos() {
    showStatusMessage(null); 
    fetchAndDisplayMovies();
}
async function fetchAndDisplayMovies() {
    moviesContainer.innerHTML = ''; 
    averageRatingElement.textContent = 'Cargando...'; 
    showStatusMessage(null); 

    const selectedCity = citySelect.value;
    try {
        const response = await fetch(`${BACKEND_URL}/g23-peliculas?city=${encodeURIComponent(selectedCity)}`);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        const movies = await response.json();
        
        const uniqueMoviesMap = new Map();
        movies.forEach(movie => {
            if (!uniqueMoviesMap.has(movie.titulo)) {
                uniqueMoviesMap.set(movie.titulo, movie);
            }
        });
        const uniqueMovies = Array.from(uniqueMoviesMap.values());

        if (uniqueMovies.length === 0) {
            showStatusMessage(noMoviesMessage, 'No hay películas para mostrar. ¡Carga algunas!', 'orange');
            averageRatingElement.textContent = 'N/A';
            return;
        }

        let totalRating = 0; 
        uniqueMovies.forEach(movie => {
            totalRating += parseFloat(movie.promedio_votos); 
            const movieCard = makeMovieCard(movie); 
            moviesContainer.appendChild(movieCard); 
        });

       
        const average = totalRating / uniqueMovies.length;
        averageRatingElement.textContent = average.toFixed(2);
        showStatusMessage(null); 

    } catch (error) {
        console.error('Error al obtener y mostrar las películas:', error);
        showStatusMessage(noMoviesMessage, `Error al cargar las películas. Por favor, verifica que tu backend esté corriendo y los permisos en Strapi. Detalle: ${error.message}`, 'var(--error-color)');
        averageRatingElement.textContent = 'Error';
    }
}


loadMoviesBtn.addEventListener('click', async () => {
    showStatusMessage(loadStatus, 'Cargando películas... Esto puede tardar un momento.', 'var(--info-color)');

    try {
        const response = await fetch(`${BACKEND_URL}/cargar-g23-peliculas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (response.ok) {
           
            if (data.message.includes('ya existen')) {
                showStatusMessage(loadStatus, `Éxito: ${data.message}`, 'orange'); 
            } else {
                showStatusMessage(loadStatus, `Éxito: ${data.message}`, 'var(--success-color)');
            }
            await fetchAndDisplayMovies(); 
        } else {
            showStatusMessage(loadStatus, `Error: ${data.message || 'No se pudo cargar las películas.'}`, 'var(--error-color)');
            console.error('Error al cargar películas desde el backend:', data);
        }
    } catch (error) {
        showStatusMessage(loadStatus, `Error de conexión: ${error.message}. Asegúrate que el backend esté corriendo.`, 'var(--error-color)');
        console.error('Error al conectar con el backend:', error);
    }
});


citySelect.addEventListener('change', fetchAndDisplayMovies);


document.addEventListener('DOMContentLoaded', () => {
    showStatusMessage(null); 
    fetchAndDisplayMovies();
});


function makeMovieCard(movie) {
    const movieCard = document.createElement('div');
    movieCard.className = "movie-card"; 

    const imageUrl = movie.poster_path;
    let prom = movie.promedio_votos;
    prom = parseFloat(prom);

    movieCard.innerHTML = `
        <img src="${imageUrl || 'https://dummyimage.com/200x300/000/fff&text=No+Image'}" alt="${movie.titulo}">
        <div class="movie-info"> <h3>${movie.titulo}</h3>
            <p>Estreno: ${movie.fecha_estreno}</p>
            <p class="rating">Rating: ${prom.toFixed(1)} / 10</p>
            <p>Votos: ${movie.cantidad_votos}</p>
            ${movie.genero && movie.genero.length > 0 ? `<p>Géneros: ${Array.isArray(movie.genero) ? movie.genero.join(', ') : movie.genero}</p>` : ''}
            ${movie.actors && movie.actors.length > 0 ? `<p>Actores: ${movie.actors.join(', ')}</p>` : ''}
        </div>
    `;

    return movieCard;
}
