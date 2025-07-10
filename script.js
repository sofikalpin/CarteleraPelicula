// La URL de tu backend de Node.js
// ¡IMPORTANTE!: Asegúrate de que este puerto coincida con el que configuraste en tu server.js
const BACKEND_URL = 'http://localhost:3000/api';

// Obtener referencias a los elementos del DOM
const loadMoviesBtn = document.getElementById('loadMoviesBtn');
const viewDataBtn = document.getElementById('viewDataBtn');
const citySelect = document.getElementById('citySelect');
const loadStatus = document.getElementById('loadStatus');
const moviesContainer = document.getElementById('moviesContainer');
const averageRatingElement = document.getElementById('averageRating');
const noMoviesMessage = document.getElementById('noMoviesMessage');

// Function to handle the "Visualizar datos" button click
function VisualizarDatos() {
    fetchAndDisplayMovies();
}

// Función para cargar y mostrar las películas desde Strapi (a través de tu backend)
async function fetchAndDisplayMovies() {
    moviesContainer.innerHTML = ''; // Limpiar el contenedor antes de cargar
    noMoviesMessage.style.display = 'none'; // Ocultar mensaje de "no hay películas"
    averageRatingElement.textContent = 'Cargando...'; // Indicar que se está cargando

    const selectedCity = citySelect.value;
    try {
        const response = await fetch(`${BACKEND_URL}/g23-peliculas?city=${encodeURIComponent(selectedCity)}`);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        const movies = await response.json();

        if (movies.length === 0) {
            noMoviesMessage.style.display = 'block';
            averageRatingElement.textContent = 'N/A';
            return;
        }

        // === SOLUCIÓN 1: Declarar totalRating AQUI ===
        let totalRating = 0; // Inicializar el total de rating AQUI, fuera del forEach

        // Iterar sobre cada película y crear su tarjeta de visualización
        movies.forEach(movie => {
            totalRating += parseFloat(movie.promedio_votos); // Sumar el promedio de votos (convertido a número)

            // === SOLUCIÓN 2: Llamar a makeMovieCard para construir la tarjeta ===
            const movieCard = makeMovieCard(movie); // Llama a la función makeMovieCard
            moviesContainer.appendChild(movieCard); // Añadir la tarjeta al contenedor
        });

        // Calcular y mostrar el rating promedio general
        const average = totalRating / movies.length;
        averageRatingElement.textContent = average.toFixed(2);

    } catch (error) {
        console.error('Error al obtener y mostrar las películas:', error);
        noMoviesMessage.style.display = 'block';
        noMoviesMessage.textContent = 'Error al cargar las películas. Por favor, verifica que tu backend esté corriendo y los permisos en Strapi.';
        averageRatingElement.textContent = 'Error';
    }
}

// Event Listener para el botón de cargar películas
loadMoviesBtn.addEventListener('click', async () => {
    loadStatus.textContent = 'Cargando películas... Esto puede tardar un momento.';
    loadStatus.style.color = '#0056b3';

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
            loadStatus.textContent = `Éxito: ${data.message}`;
            loadStatus.style.color = '#28a745';
            await fetchAndDisplayMovies();
        } else {
            loadStatus.textContent = `Error: ${data.message || 'No se pudo cargar las películas.'}`;
            loadStatus.style.color = '#dc3545';
            console.error('Error al cargar películas desde el backend:', data);
        }
    } catch (error) {
        loadStatus.textContent = `Error de conexión: ${error.message}. Asegúrate que el backend esté corriendo.`;
        loadStatus.style.color = '#dc3545';
        console.error('Error al conectar con el backend:', error);
    }
});

// Event Listener for the city dropdown
citySelect.addEventListener('change', fetchAndDisplayMovies);

// Cargar las películas cuando la página se cargue por primera vez (al abrir index.html)
document.addEventListener('DOMContentLoaded', fetchAndDisplayMovies);


// === makeMovieCard - Función para crear la tarjeta de una película ===
function makeMovieCard(movie) {
    const movieCard = document.createElement('div');
    movieCard.className = "movie-card";
    movieCard.style.display = "flex";
    movieCard.style.flexDirection = "column";
    movieCard.style.alignItems = "stretch";
    movieCard.style.gap = "1.5rem";
    movieCard.style.backgroundColor = "#2e0f12";
    movieCard.style.color = "#f5f5f5";
    movieCard.style.padding = "0rem";
    movieCard.style.paddingBottom = "1.5rem";
    movieCard.style.borderRadius = "1rem";
    movieCard.style.boxShadow = "0 0 10px #00000080";
    movieCard.style.maxWidth = "15dvw";
    movieCard.style.margin = "2rem auto";
    movieCard.style.textAlign = "left"; 

    // No necesitas totalRating aquí, ya que se calcula en fetchAndDisplayMovies
    // let totalRating = 0;
    // totalRating += movie.promedio_votos; 

    const imageUrl = movie.poster_path;
    let prom = movie.promedio_votos; // movie.promedio_votos ya debería ser un string de número o un número
    prom = parseFloat(prom); // Convertir a número flotante

    // Construir el HTML interno para la tarjeta de la película
    movieCard.innerHTML = `
        <img src="${imageUrl || 'https://dummyimage.com/200x300/000/fff&text=No+Image'}" alt="${movie.titulo}">
        <div class="movie-info" style="padding-left: 1.5rem;">
            <h3>${movie.titulo}</h3> 
            <p>Estreno: ${movie.fecha_estreno}</p> 
            <p class="rating">Rating: ${prom.toFixed(1)} / 10</p> 
            <p>Votos: ${movie.cantidad_votos}</p>
            ${movie.genero && movie.genero.length > 0 ? `<p>Géneros: ${Array.isArray(movie.genero) ? movie.genero.join(', ') : movie.genero}</p>` : ''}
            ${movie.actors && movie.actors.length > 0 ? `<p>Actores: ${movie.actors.join(', ')}</p>` : ''}
        </div>
    `;

    return movieCard;
}