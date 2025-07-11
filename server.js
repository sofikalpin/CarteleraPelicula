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
const TMDB_GENRES_URL = `${TMDB_BASE_URL}/genre/movie/list`; 
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; 

let tmdbGenresCache = null;
let strapiGenresCache = null;

async function fetchTmdbGenres() {
     if (tmdbGenresCache) return tmdbGenresCache;

    try {
        const response = await axios.get(TMDB_GENRES_URL, {params: { api_key: TMDB_API_KEY, language: 'es-ES' }});
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
             const strapiResponse = await axios.get(`${STRAPI_API_URL}/g23-generos`, {
             headers: {
             Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
             }
            }); 
             const existingStrapiGenres = strapiResponse.data.data;
             existingStrapiGenres.forEach(genre => {
             strapiGenresCache.set(genre.attributes.nombre, genre.id); 
             });
             console.log(`Géneros existentes en Strapi cargados: ${existingStrapiGenres.length}`);
        } catch (error) {
             console.error('Error al obtener géneros de Strapi:', error.response ? error.response.data : error.message);
         }
     }

    const tmdbGenre = tmdbGenresCache.find(g => g.id === tmdbGenreId);
     if (!tmdbGenre) {
     console.warn(`Género TMDB con ID ${tmdbGenreId} no encontrado.`);
     return null;
     }

    const tmdbGenreName = tmdbGenre.name;
    let strapiGenreId = strapiGenresCache.get(tmdbGenreName);


     if (!strapiGenreId) {
     console.log(`Creando género "${tmdbGenreName}" en Strapi...`);
     try {
        const createResponse = await axios.post(`${STRAPI_API_URL}/g23-generos`, { 
            data:{
                nombre: tmdbGenreName
                }
             }, {
             headers: {
             Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
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

app.post('/api/cargar-g23-peliculas', async (req, res) => {
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
        const existingMovie = await axios.get(`${STRAPI_API_URL}/g23-peliculas`, {
         params: {
                 'filters[tmdb_id][$eq]': movie.id 
                 },
                 headers: {
                 Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
                 }
        });
             if (existingMovie.data.data.length > 0) {
                console.log(`Película "${movie.title}" (ID: ${movie.id}) ya existe en Strapi. Saltando.`)
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
         let strapiActorIds = [];
         try {
            const creditsRes=await axios.get(`${TMDB_BASE_URL}/movie/${movie.id}/credits`, {
              params: {
                api_key: TMDB_API_KEY,
                lenguage: 'es-ES'
              }
            });
            const topActors = creditsRes.data.cast.slice(0,3);
            for (const actor of topActors) {
      
              const actorRes = await axios.get(`${STRAPI_API_URL}/g23-actors`, {
                params: {
                  'filters[nombre][$eq]': actor.name
                },
                headers: {
                  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
                }
           })
           
           let actorId;
           if(actorRes.data.data.length > 0) {
             actorId = actorRes.data.data[0].id;
           } else {
          
             const createActorRes = await axios.post(`${STRAPI_API_URL}/g23-actors`,{
                data: { nombre: actor.nombre }
             }, {
               headers: {
                Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
               }
             });
             actorId = createActorRes.data.data.id;
           }
           strapiActorIds.push(actorId);
         }
      } catch (actorErr) {
        console.error(`Error al obtener actores de TMDB para "${movie.title}":`, actorErr.message);
      }

         const posterUrl = movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null;
         const strapiMovieData = {
             data: {
                    titulo: movie.title, 
                    fecha_estreno: movie.release_date,
                    cantidad_votos: movie.vote_count, 
                    promedio_votos: movie.vote_average, 
                    g_23_generos: strapiGenreIds.length > 0 ? strapiGenreIds : null,
                    g_23_actors: strapiActorIds.length > 0 ? strapiActorIds : null,
                    tmdb_id: movie.id,
                    poster_path: posterUrl, 
                }
            };

             try {
                await axios.post(`${STRAPI_API_URL}/g23-peliculas`, strapiMovieData,{ 
                headers: {
                     Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
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


app.get('/api/g23-peliculas', async (req, res) => {
    try {
        console.log('Obteniendo películas de Strapi...');

        const selectedCity = req.query.city || 'Buenos Aires';
        console.log(`Simulando películas para la ciudad: ${selectedCity}`);

    const strapiResponse = await axios.get(`${STRAPI_API_URL}/g23-peliculas`, {
    params: {
            'populate': {
             'g_23_generos': { 
                fields: ['nombre'] 
             },
            'g_23_actors': {  
             fields: ['nombre'] 
             }
            }
        },
        headers: {
             Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
        }
    });
        console.log(strapiResponse.data);     
   
const moviesFromStrapi = strapiResponse.data.data.map(item => {

   
    let generoDisplay = null;
    if (item.g_23_generos && Array.isArray(item.g_23_generos)) {
        generoDisplay = item.g_23_generos.map(g => g.nombre);
    }
   

  
    let actorNames = [];
    if (item.g_23_actors && Array.isArray(item.g_23_actors)) {
        actorNames = item.g_23_actors.map(actor => actor.nombre);
    }
    

    return {
        id: item.id,
        titulo: item.titulo,
        sinopsis: item.sinopsis,
        cantidad_votos: item.cantidad_votos,
        promedio_votos: item.promedio_votos,
        fecha_estreno: item.fecha_estreno,
        poster_path: item.poster_path,
        genero: generoDisplay, 
        actors: actorNames 
    };
});


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
app.delete('/api/eliminar-peliculas', async (req, res) => {
  try {
    console.log('Iniciando borrado de TODAS las películas en Strapi...');
    let totalDeleted = 0;

    while (true) {
      const getRes = await axios.get(`${STRAPI_API_URL}/g23-peliculas`, {
        params: { pagination: { pageSize: 100 } },
        headers: {
          Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
        }
      });

      const peliculas = getRes.data.data;
      if (peliculas.length === 0) break;

      for (const peli of peliculas) {
        await axios.delete(`${STRAPI_API_URL}/g23-peliculas/${peli.id}`, {
          headers: {
            Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`
          }
        });
        console.log(`Eliminada película ID: ${peli.id}`);
        totalDeleted++;
      }
    }

    res.status(200).json({ message: `Se eliminaron ${totalDeleted} películas de Strapi.` });
  } catch (err) {
    console.error('Error al eliminar películas:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${port}`);
    console.log(`API Key de TMDB: ${TMDB_API_KEY ? 'Cargada' : 'NO CARGADA - Revisa tu .env'}`);
    console.log(`URL de Strapi: ${STRAPI_API_URL}`);
});
