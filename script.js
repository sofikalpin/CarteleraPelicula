// La URL de tu backend de Node.js
// ¡IMPORTANTE!: Asegúrate de que este puerto coincida con el que configuraste en tu server.js
const BACKEND_URL = 'http://localhost:3000/api'; 

// Obtener referencias a los elementos del DOM
const loadMoviesBtn = document.getElementById('loadMoviesBtn');
const loadStatus = document.getElementById('loadStatus');
const moviesContainer = document.getElementById('moviesContainer');
const averageRatingElement = document.getElementById('averageRating');
const noMoviesMessage = document.getElementById('noMoviesMessage');

// Función para cargar y mostrar las películas desde Strapi (a través de tu backend)
async function fetchAndDisplayMovies() {
    moviesContainer.innerHTML = ''; // Limpiar el contenedor antes de cargar
    noMoviesMessage.style.display = 'none'; // Ocultar mensaje de "no hay películas"
    averageRatingElement.textContent = 'Cargando...'; // Indicar que se está cargando

    try {
        // Hacemos una solicitud GET a nuestro backend para obtener las películas desde Strapi
        const response = await fetch(`${BACKEND_URL}/peliculas`);
        if (!response.ok) {
            // Si la respuesta HTTP no es exitosa (ej. 404, 500), lanzar un error
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }
        const movies = await response.json();

        // Si no hay películas, mostrar un mensaje y salir
        if (movies.length === 0) {
            noMoviesMessage.style.display = 'block'; // Mostrar mensaje de no películas
            averageRatingElement.textContent = 'N/A'; // No hay rating para calcular
            return;
        }

        let totalRating = 0;

        // Iterar sobre cada película y crear su tarjeta de visualización
        movies.forEach(movie => {
            totalRating += movie.promedio_votos; // Sumar el promedio de votos de cada película

            const movieCard = document.createElement('div');
            movieCard.className = 'movie-card';

            // La 'poster_path' ya debe venir como una URL completa desde el backend
            // Si no tienes este campo o no lo mapeas, considera poner una imagen placeholder por defecto
            const imageUrl = movie.poster_path; 
            
            // Construir el HTML interno para la tarjeta de la película
            movieCard.innerHTML = `
                <img src="${imageUrl || 'https://via.placeholder.com/200x300?text=No+Image'}" alt="${movie.titulo}">
                <div class="movie-info">
                    <h3>${movie.titulo}</h3> 
                    <p>Estreno: ${movie.fecha_estreno}</p> 
                    <p class="rating">Rating: ${movie.promedio_votos.toFixed(1)} / 10</p> 
                    <p>Votos: ${movie.cantidad_votos}</p>
                    ${movie.genero && movie.genero.length > 0 ? `<p>Géneros: ${Array.isArray(movie.genero) ? movie.genero.join(', ') : movie.genero}</p>` : ''}
                    ${movie.actors && movie.actors.length > 0 ? `<p>Actores: ${movie.actors.join(', ')}</p>` : ''}
                </div>
            `;
            moviesContainer.appendChild(movieCard); // Añadir la tarjeta al contenedor
        });

        // Calcular y mostrar el rating promedio general
        const average = totalRating / movies.length;
        averageRatingElement.textContent = average.toFixed(2); // Mostrar con 2 decimales

    } catch (error) {
        console.error('Error al obtener y mostrar las películas:', error);
        noMoviesMessage.style.display = 'block'; // Mostrar mensaje de error
        noMoviesMessage.textContent = 'Error al cargar las películas. Por favor, verifica que tu backend esté corriendo y los permisos en Strapi.';
        averageRatingElement.textContent = 'Error';
    }
}

// Event Listener para el botón de cargar películas
loadMoviesBtn.addEventListener('click', async () => {
    loadStatus.textContent = 'Cargando películas... Esto puede tardar un momento.';
    loadStatus.style.color = '#0056b3'; // Azul para indicar progreso

    try {
        // Hacemos una solicitud POST a nuestro backend para que inicie el proceso de carga
        const response = await fetch(`${BACKEND_URL}/cargar-peliculas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // El cuerpo puede estar vacío si el backend no espera datos específicos
        });

        const data = await response.json();

        if (response.ok) {
            loadStatus.textContent = `Éxito: ${data.message}`;
            loadStatus.style.color = '#28a745'; // Verde para éxito
            // Después de cargar, recargamos la visualización de las películas para mostrar las nuevas
            await fetchAndDisplayMovies();
        } else {
            loadStatus.textContent = `Error: ${data.message || 'No se pudo cargar las películas.'}`;
            loadStatus.style.color = '#dc3545'; // Rojo para error
            console.error('Error al cargar películas desde el backend:', data);
        }
    } catch (error) {
        loadStatus.textContent = `Error de conexión: ${error.message}. Asegúrate que el backend esté corriendo.`;
        loadStatus.style.color = '#dc3545'; // Rojo para error
        console.error('Error al conectar con el backend:', error);
    }
});

// Cargar las películas cuando la página se cargue por primera vez (al abrir index.html)
document.addEventListener('DOMContentLoaded', fetchAndDisplayMovies);