// La URL de tu backend de Node.js
// ¡IMPORTANTE!: Asegúrate de que este puerto coincida con el que configuraste en tu server.js
const BACKEND_URL = 'http://localhost:3000/api';

// Obtener referencias a los elementos del DOM
const loadMoviesBtn = document.getElementById('loadMoviesBtn');
const viewDataBtn = document.getElementById('viewDataBtn');
const citySelect = document.getElementById('citySelect');

// NEW: Reference to the status messages container
const statusMessagesContainer = document.getElementById('statusMessagesContainer');
const loadStatus = document.getElementById('loadStatus');
const noMoviesMessage = document.getElementById('noMoviesMessage');

const moviesContainer = document.getElementById('moviesContainer');
const averageRatingElement = document.getElementById('averageRating');

// Helper function to manage status message visibility
function showStatusMessage(elementToShow, message, color = null) {
    // Hide all potential status messages first
    loadStatus.style.display = 'none';
    noMoviesMessage.style.display = 'none';
    loadStatus.textContent = ''; // Clear previous messages
    noMoviesMessage.textContent = ''; // Clear previous messages

    // Show the desired message
    if (elementToShow) {
        elementToShow.textContent = message;
        elementToShow.style.display = 'block';
        if (color) {
            elementToShow.style.color = color;
        }
    }
}

// Function to handle the "Visualizar datos" button click
function VisualizarDatos() {
    showStatusMessage(null); // Clear any existing status messages
    fetchAndDisplayMovies();
}

// Función para cargar y mostrar las películas desde Strapi (a través de tu backend)
async function fetchAndDisplayMovies() {
    moviesContainer.innerHTML = ''; // Limpiar el contenedor antes de cargar
    averageRatingElement.textContent = 'Cargando...'; // Indicar que se está cargando
    showStatusMessage(null); // Hide any previous status messages when starting a new fetch

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

        let totalRating = 0; // Inicializar el total de rating AQUI, fuera del forEach

        uniqueMovies.forEach(movie => {
            totalRating += parseFloat(movie.promedio_votos); // Sumar el promedio de votos (convertido a número)
            const movieCard = makeMovieCard(movie); // Llama a la función makeMovieCard
            moviesContainer.appendChild(movieCard); // Añadir la tarjeta al contenedor
        });

        // Calcular y mostrar el rating promedio general
        const average = totalRating / uniqueMovies.length;
        averageRatingElement.textContent = average.toFixed(2);
        showStatusMessage(null); // Clear any status message if movies are successfully displayed

    } catch (error) {
        console.error('Error al obtener y mostrar las películas:', error);
        showStatusMessage(noMoviesMessage, `Error al cargar las películas. Por favor, verifica que tu backend esté corriendo y los permisos en Strapi. Detalle: ${error.message}`, 'var(--error-color)');
        averageRatingElement.textContent = 'Error';
    }
}

// Event Listener para el botón de cargar películas
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
            // Check if the message contains "ya existen" to use a different color or message
            if (data.message.includes('ya existen')) {
                showStatusMessage(loadStatus, `Éxito: ${data.message}`, 'orange'); // Use orange for "already exists"
            } else {
                showStatusMessage(loadStatus, `Éxito: ${data.message}`, 'var(--success-color)');
            }
            await fetchAndDisplayMovies(); // Refresh movies after loading
        } else {
            showStatusMessage(loadStatus, `Error: ${data.message || 'No se pudo cargar las películas.'}`, 'var(--error-color)');
            console.error('Error al cargar películas desde el backend:', data);
        }
    } catch (error) {
        showStatusMessage(loadStatus, `Error de conexión: ${error.message}. Asegúrate que el backend esté corriendo.`, 'var(--error-color)');
        console.error('Error al conectar con el backend:', error);
    }
});

// Event Listener for the city dropdown
citySelect.addEventListener('change', fetchAndDisplayMovies);

// Cargar las películas cuando la página se cargue por primera vez (al abrir index.html)
document.addEventListener('DOMContentLoaded', () => {
    showStatusMessage(null); // Ensure all messages are hidden on initial load
    fetchAndDisplayMovies();
});


// === makeMovieCard - Función para crear la tarjeta de una película ===
function makeMovieCard(movie) {
    const movieCard = document.createElement('div');
    movieCard.className = "movie-card"; // Apply the class defined in styles.css

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
