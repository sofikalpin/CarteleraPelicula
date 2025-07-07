require('dotenv').config();

const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const STRAPI_API_URL = process.env.STRAPI_API_URL;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_GENRES_URL = `${TMDB_BASE_URL}/genre/movie/list`; // URL para obtener géneros de TMDB
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; 

const SIMULATED_CITY = "Buenos Aires"; 

let tmdbGenresCache = null;
let strapiGenresCache = null;

async function fetchTmdbGenres() {
    if (tmdbGenresCache) return tmdbGenresCache;

    try {
        const response = await axios.get(TMDB_GENRES_URL, {
            params: { api_key: TMDB_API_KEY, language: 'es-ES' }
        });
        tmdbGenresCache = response.data.genres;
        console.log('Géneros de TMDB cargados y cacheados.');
        return tmdbGenresCache;
    } catch (error) {
        console.error('Error al obtener géneros de TMDB:', error.response ? error.response.data : error.message);
        return [];
    }
}

async function getStrapiGenreId(tmdbGenreId) {
    if (!strapiGenresCache) {
        strapiGenresCache = new Map(); 
        const tmdbGenres = await fetchTmdbGenres();
        if (tmdbGenres.length === 0) {
            console.warn('No se pudieron obtener géneros de TMDB, no se podrá mapear géneros.');
            return null;
        }

        try {
            const strapiResponse = await axios.get(`${STRAPI_API_URL}/generos`, {
              headers: {
                  Authorization: `Bearer ${process.env.STRAPI_TOKEN}`
                }
            }); 
            const existingStrapiGenres = strapiResponse.data.data;
            existingStrapiGenres.forEach(genre => {
                strapiGenresCache.set(genre.attributes.nombre, genre.id); 
            });
            console.log(`Géneros existentes en Strapi cargados: ${existingStrapiGenres.length}`);
        } catch (error) {
            console.error('Error al obtener géneros de Strapi:', error.response ? error.response.data : error.message);
            // Continuar incluso si falla la obtención de géneros de Strapi
        }
    }

    const tmdbGenre = tmdbGenresCache.find(g => g.id === tmdbGenreId);
    if (!tmdbGenre) {
        console.warn(`Género TMDB con ID ${tmdbGenreId} no encontrado.`);
        return null;
    }

    const tmdbGenreName = tmdbGenre.name;
    let strapiGenreId = strapiGenresCache.get(tmdbGenreName);

    // Si el género no está en Strapi, crearlo
    if (!strapiGenreId) {
        console.log(`Creando género "${tmdbGenreName}" en Strapi...`);
        try {
            const createResponse = await axios.post(`${STRAPI_API_URL}/generos`, { 
                data: {
                    nombre: tmdbGenreName
                }
            }, {
              headers: {
                Authorization: `Bearer ${process.env.STRAPI_TOKEN}`
              } 
            });
            strapiGenreId = createResponse.data.data.id;
            strapiGenresCache.set(tmdbGenreName, strapiGenreId); 
            console.log(`Género "${tmdbGenreName}" creado con ID ${strapiGenreId} en Strapi.`);
        } catch (error) {
            console.error(`Error al crear el género "${tmdbGenreName}" en Strapi:`, error.response ? error.response.data : error.message);
            return null; 
        }
    }
    return strapiGenreId; 
}


// 1. Endpoint para obtener películas de TheMovieDB y guardarlas en Strapi
app.post('/api/cargar-peliculas', async (req, res) => {
    try {
        console.log('Iniciando carga de películas desde TheMovieDB a Strapi...');

        await fetchTmdbGenres(); 
        if (!tmdbGenresCache || tmdbGenresCache.length === 0) {
            throw new Error('No se pudieron obtener los géneros de TheMovieDB. Imposible continuar.');
        }

        const tmdbResponse = await axios.get(`${TMDB_BASE_URL}/movie/now_playing`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'es-ES',
                page: 1
            }
        });

        const movies = tmdbResponse.data.results;
        console.log(`Se obtuvieron ${movies.length} películas de TheMovieDB.`);

        let savedMoviesCount = 0;
        let duplicateMoviesCount = 0;

        for (const movie of movies) {
            const existingMovie = await axios.get(`${STRAPI_API_URL}/peliculas`, {
                params: {
                    'filters[tmdb_id][$eq]': movie.id 
                },
                headers: {
                  Authorization: `Bearer ${process.env.STRAPI_TOKEN}`
                }
            });
            if (existingMovie.data.data.length > 0) {
                console.log(`Película "${movie.title}" (ID: ${movie.id}) ya existe en Strapi. Saltando.`);
                duplicateMoviesCount++;
                continue; 
            }

            const strapiGenreIds = [];
            for (const tmdbGenreId of movie.genre_ids) {
                const strapiId = await getStrapiGenreId(tmdbGenreId);
                if (strapiId) {
                    strapiGenreIds.push(strapiId);
                }
            }
            // editar para coincidir con el strapi FALTAN ACTORES !
            const strapiMovieData = {
                data: {
                    titulo: movie.title, 
                    fecha_estreno: movie.release_date, 
                    cantidad_votos: movie.vote_count, 
                    promedio_votos: movie.vote_average, 
                    genero: strapiGenreIds.length > 0 ? strapiGenreIds : null, 
                }
            };

            try {
                await axios.post(`${STRAPI_API_URL}/peliculas`, strapiMovieData, {
                  headers: {
                    Authorization: `Bearer ${process.env.STRAPI_TOKEN}`
                  }
                });
                console.log(`Película "${movie.title}" guardada en Strapi.`);
                savedMoviesCount++;
            } catch (strapiError) {
                console.error(`Error al guardar la película "${movie.title}" en Strapi:`, strapiError.response ? strapiError.response.data : strapiError.message);
            }
        }

        res.status(200).json({
            message: `Proceso de carga finalizado. ${savedMoviesCount} películas nuevas guardadas, ${duplicateMoviesCount} películas ya existentes.`,
            total_movies_processed: movies.length
        });

    } catch (error) {
        console.error('Error general al cargar las películas:', error.message);
        if (error.response) {
            console.error('Detalles del error de la API (TMDB o Strapi):', error.response.data);
        }
        res.status(500).json({
            message: 'Error al procesar la solicitud de carga de películas.',
            error: error.message
        });
    }
});

// 2. Endpoint para obtener películas de Strapi
app.get('/api/peliculas', async (req, res) => {
    try {
        console.log('Obteniendo películas de Strapi...');
        const cityFilter = req.query.city || SIMULATED_CITY; 

        const strapiResponse = await axios.get(`${STRAPI_API_URL}/peliculas`, {
            params: {
//                filters: { city: { $eq: cityFilter } },
                'populate': 'genero,actors' 
            }, 
          headers: {
            Authorization: `Bearer ${process.env.STRAPI_TOKEN}`
          }
        });
//editar para coincidir con cont de strapi (populate).
        const moviesFromStrapi = strapiResponse.data.data.map(item => ({
            id: item.id, 
            titulo: item.attributes.titulo, 
            fecha_estreno: item.attributes.fecha_estreno, 
            cantidad_votos: item.attributes.cantidad_votos, 
            promedio_votos: item.attributes.promedio_votos, 
            genero: item.attributes.genero && item.attributes.genero.data 
                      ? (Array.isArray(item.attributes.genero.data) 
                          ? item.attributes.genero.data.map(g => g.attributes.nombre) 
                          : item.attributes.genero.data.attributes.nombre)
                      : null,
            actors: item.attributes.actors && item.attributes.actors.data
                      ? item.attributes.actors.data.map(actor => actor.attributes.nombre) 
                      : []
        }));

        console.log(`Se obtuvieron ${moviesFromStrapi.length} películas de Strapi`);
        res.status(200).json(moviesFromStrapi);

    } catch (error) {
        console.error('Error al obtener películas de Strapi:', error.message);
        if (error.response) {
            console.error('Detalles del error de Strapi:', error.response.data);
        }
        res.status(500).json({
            message: 'Error al obtener películas de Strapi.',
            error: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${port}`);
    console.log(`API Key de TMDB: ${TMDB_API_KEY ? 'Cargada' : 'NO CARGADA - Revisa tu .env'}`);
    console.log(`URL de Strapi: ${STRAPI_API_URL}`);
});
