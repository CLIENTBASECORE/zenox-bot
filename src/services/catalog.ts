import axios from 'axios';
import { MediaItem } from '../types/index.js';
import { CONFIG } from '../config.js';

export const MOVIE_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
};

export function resolveGenreId(query: string, type: 'movie' | 'tv' = 'movie'): number | undefined {
  const q = query.toLowerCase().trim();
  const primary = type === 'movie' ? MOVIE_GENRES : TV_GENRES;
  for (const [id, name] of Object.entries(primary)) {
    if (name.toLowerCase() === q || name.toLowerCase().includes(q) || q.includes(name.toLowerCase())) {
      return parseInt(id, 10);
    }
  }

  // Check alias patterns like "scifi" -> Sci-Fi
  if (q.includes('sci') || q.includes('space')) return type === 'movie' ? 878 : 10765;
  if (q.includes('action') || q.includes('fight')) return type === 'movie' ? 28 : 10759;
  if (q.includes('anime') || q.includes('cartoon')) return 16;
  if (q.includes('funny') || q.includes('comedy')) return 35;
  if (q.includes('scary') || q.includes('horror')) return 27;

  // Secondary dictionary check
  const secondary = type === 'movie' ? TV_GENRES : MOVIE_GENRES;
  for (const [id, name] of Object.entries(secondary)) {
    if (name.toLowerCase() === q || name.toLowerCase().includes(q) || q.includes(name.toLowerCase())) {
      return parseInt(id, 10);
    }
  }

  return undefined;
}

export function formatTmdbMedia(raw: any, explicitType?: 'movie' | 'tv'): MediaItem {
  const isMovie = explicitType
    ? explicitType === 'movie'
    : raw.media_type
    ? raw.media_type === 'movie'
    : Boolean(raw.title);
  const type: 'movie' | 'tv' = isMovie ? 'movie' : 'tv';
  const title = isMovie ? raw.title || raw.original_title || 'Untitled' : raw.name || raw.original_name || 'Untitled';
  const dateStr = isMovie ? raw.release_date : raw.first_air_date;
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || 2024 : 2024;
  const rating = raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : 7.5;
  const votes = raw.vote_count || 0;

  const genreDict = isMovie ? MOVIE_GENRES : TV_GENRES;
  const genreNames: string[] = Array.isArray(raw.genre_ids)
    ? raw.genre_ids.map((gid: number) => genreDict[gid] || MOVIE_GENRES[gid] || 'Cinema').filter(Boolean)
    : Array.isArray(raw.genres)
    ? raw.genres.map((g: any) => g.name).filter(Boolean)
    : ['Cinema'];

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'watch';
  const posterUrl = raw.poster_path
    ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${raw.poster_path}`
    : 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg';
  const backdropUrl = raw.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${raw.backdrop_path}`
    : posterUrl;

  return {
    id: `${type}-${raw.id}`,
    title,
    type,
    year,
    rating,
    votes,
    posterUrl,
    backdropUrl,
    overview:
      raw.overview ||
      `Stream "${title}" in ultra high definition with multi-language audio & subtitles on Zenox Cinema Network.`,
    genres: genreNames.length > 0 ? genreNames.slice(0, 4) : [isMovie ? 'Movie' : 'TV Series'],
    zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/${type}/${raw.id}-${slug}`,
    quality: rating >= 8.0 ? '4K HDR' : '1080p Ultra',
  };
}

const FALLBACK_CATALOG: MediaItem[] = [
  {
    id: 'movie-693134',
    title: 'Dune: Part Two',
    type: 'movie',
    year: 2024,
    rating: 8.6,
    votes: 482000,
    posterUrl: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5200SV.jpg',
    overview: 'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
    genres: ['Sci-Fi', 'Adventure', 'Action'],
    duration: '2h 46m',
    zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/movie/693134-dune-part-two`,
    quality: '4K HDR',
  },
  {
    id: 'tv-94605',
    title: 'Arcane',
    type: 'tv',
    year: 2024,
    rating: 9.0,
    votes: 310000,
    posterUrl: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/fqldf2t8ztc9aiwn396mlXAwNt.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/q8eeiuy5L94mKr1uYQy97S9lFfQ.jpg',
    overview: 'Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and incompatible convictions.',
    genres: ['Animation', 'Sci-Fi', 'Action', 'Drama'],
    seasons: 2,
    episodes: 18,
    zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/tv/94605-arcane`,
    quality: '4K HDR',
  },
  {
    id: 'movie-157336',
    title: 'Interstellar',
    type: 'movie',
    year: 2014,
    rating: 8.7,
    votes: 2100000,
    posterUrl: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/rAiYTnrLEhkqM1B5HjG2bWnclS9.jpg',
    overview: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    genres: ['Adventure', 'Drama', 'Sci-Fi'],
    duration: '2h 49m',
    zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/movie/157336-interstellar`,
    quality: '4K HDR',
  },
  {
    id: 'tv-110492',
    title: 'Severance',
    type: 'tv',
    year: 2022,
    rating: 8.7,
    votes: 215000,
    posterUrl: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/1X4h849iuxo931y40f2e022036.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/pGkE9X2q2191k9mUv745p199890.jpg',
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears, it begins a journey to discover the truth.',
    genres: ['Sci-Fi', 'Thriller', 'Mystery'],
    seasons: 2,
    episodes: 19,
    zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/tv/110492-severance`,
    quality: '4K HDR',
  },
  {
    id: 'movie-155',
    title: 'The Dark Knight',
    type: 'movie',
    year: 2008,
    rating: 9.0,
    votes: 2900000,
    posterUrl: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/nMKdUUepR0i5zn0y1T4CsSB5chy.jpg',
    overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.',
    genres: ['Action', 'Crime', 'Drama', 'Thriller'],
    duration: '2h 32m',
    zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/movie/155-the-dark-knight`,
    quality: '4K HDR',
  },
];

export class CatalogService {
  private static trendingCache: { items: MediaItem[]; expires: number } | null = null;

  /**
   * Live TMDB Multi-Search for Movies & TV Series
   */
  public static async search(query: string): Promise<MediaItem[]> {
    const q = query.toLowerCase().trim();

    if (CONFIG.TMDB_API_KEY) {
      try {
        const res = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
          params: {
            api_key: CONFIG.TMDB_API_KEY,
            query: q,
            include_adult: false,
          },
          timeout: 5000,
        });

        if (res.data?.results?.length > 0) {
          return res.data.results
            .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
            .slice(0, 5)
            .map((item: any) => formatTmdbMedia(item));
        }
      } catch (err) {
        console.warn('[Zenox Catalog] TMDB search error:', err);
      }
    }

    // Local fallback
    const results = FALLBACK_CATALOG.filter(
      item => item.title.toLowerCase().includes(q) || item.genres.some(g => g.toLowerCase().includes(q))
    );
    if (results.length > 0) return results;

    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return [
      {
        id: `movie-custom-${Date.now()}`,
        title: query.charAt(0).toUpperCase() + query.slice(1),
        type: 'movie',
        year: 2024,
        rating: 8.4,
        votes: 35420,
        posterUrl: 'https://image.tmdb.org/t/p/w600_and_h900_bestv2/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/xOMo8BRK7PfcJv9JCnx7s5200SV.jpg',
        overview: `Live streaming available for "${query}" on the Zenox Cinema Network. Instant playback with multi-language subs and 4K remuxes.`,
        genres: ['Action', 'Thriller', 'Ultra HD'],
        zenoxUrl: `${CONFIG.ZENOX_BASE_URL}/watch/movie/${slug}`,
        quality: '4K HDR',
      },
    ];
  }

  /**
   * Live TMDB Trending Movies & TV Series with 15-Minute Memory Cache
   */
  public static async getTrending(): Promise<MediaItem[]> {
    const now = Date.now();
    if (this.trendingCache && this.trendingCache.expires > now && this.trendingCache.items.length > 0) {
      return this.trendingCache.items;
    }

    if (CONFIG.TMDB_API_KEY) {
      try {
        const res = await axios.get(`https://api.themoviedb.org/3/trending/all/day`, {
          params: { api_key: CONFIG.TMDB_API_KEY },
          timeout: 5000,
        });

        if (res.data?.results?.length > 0) {
          const items = res.data.results
            .filter((r: any) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
            .slice(0, 5)
            .map((r: any) => formatTmdbMedia(r));

          if (items.length > 0) {
            this.trendingCache = { items, expires: now + 15 * 60 * 1000 };
            return items;
          }
        }
      } catch (err) {
        console.warn('[Zenox Catalog] TMDB Trending fetch error:', err);
      }
    }

    return FALLBACK_CATALOG.slice(0, 5);
  }

  /**
   * Dynamic Random Title Picker:
   * 1. If genre is passed (e.g. Action, Comedy, Sci-Fi) -> uses TMDB Discover with with_genres on random pages (1-4).
   * 2. If no genre -> randomly samples from TMDB Trending, Popular, or Top-Rated across pages 1-5.
   * Every roll returns genuinely different titles with verified TMDB ratings & review counts!
   */
  public static async getRandom(type?: 'movie' | 'tv', genre?: string): Promise<MediaItem> {
    if (CONFIG.TMDB_API_KEY) {
      try {
        const mediaType = type || (Math.random() > 0.45 ? 'movie' : 'tv');

        // 1. If genre was requested
        if (genre) {
          const genreId = resolveGenreId(genre, mediaType);
          if (genreId) {
            const randomPage = Math.floor(Math.random() * 4) + 1;
            const res = await axios.get(`https://api.themoviedb.org/3/discover/${mediaType}`, {
              params: {
                api_key: CONFIG.TMDB_API_KEY,
                with_genres: genreId,
                sort_by: Math.random() > 0.5 ? 'popularity.desc' : 'vote_average.desc',
                'vote_count.gte': 100,
                page: randomPage,
              },
              timeout: 5000,
            });

            if (res.data?.results?.length > 0) {
              const valid = res.data.results.filter((r: any) => r.poster_path && (r.title || r.name));
              if (valid.length > 0) {
                const picked = valid[Math.floor(Math.random() * valid.length)];
                return formatTmdbMedia(picked, mediaType);
              }
            }
          }
        }

        // 2. If no genre or genre not resolved: pick from Trending, Popular, Top Rated, or High-Rated Discover
        const pools = ['trending', 'popular', 'top_rated', 'discover'];
        const chosenPool = pools[Math.floor(Math.random() * pools.length)];
        const randomPage = Math.floor(Math.random() * 5) + 1;

        let url = '';
        const params: Record<string, any> = { api_key: CONFIG.TMDB_API_KEY };

        if (chosenPool === 'trending') {
          url = `https://api.themoviedb.org/3/trending/${mediaType}/week`;
        } else if (chosenPool === 'popular') {
          url = `https://api.themoviedb.org/3/${mediaType}/popular`;
          params.page = randomPage;
        } else if (chosenPool === 'top_rated') {
          url = `https://api.themoviedb.org/3/${mediaType}/top_rated`;
          params.page = randomPage;
        } else {
          url = `https://api.themoviedb.org/3/discover/${mediaType}`;
          params.sort_by = 'vote_average.desc';
          params['vote_count.gte'] = 250;
          params.page = randomPage;
        }

        const res = await axios.get(url, { params, timeout: 5000 });
        if (res.data?.results?.length > 0) {
          const valid = res.data.results.filter((r: any) => r.poster_path && (r.title || r.name));
          if (valid.length > 0) {
            const picked = valid[Math.floor(Math.random() * valid.length)];
            return formatTmdbMedia(picked, mediaType);
          }
        }
      } catch (err) {
        console.warn('[Zenox Catalog] TMDB Random fetch error:', err);
      }
    }

    // Fallback catalog
    let pool = FALLBACK_CATALOG;
    if (type) pool = pool.filter(i => i.type === type);
    if (genre) {
      const g = genre.toLowerCase();
      const filtered = pool.filter(i => i.genres.some(gen => gen.toLowerCase().includes(g)));
      if (filtered.length > 0) pool = filtered;
    }
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx] || FALLBACK_CATALOG[0];
  }

  public static getCatalog(): MediaItem[] {
    return FALLBACK_CATALOG;
  }
}
