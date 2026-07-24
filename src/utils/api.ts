// Helper to perform API requests with support for custom backend URL (VITE_API_URL), Cloud Run production backend fallback, or relative host
export const CLOUD_RUN_API_URL = 'https://ais-pre-mspmaj3jr76kak5lfjtw3r-421365387983.us-west1.run.app';

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const customApiUrl = import.meta.env.VITE_API_URL;
  const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');

  const isExternalHost = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.endsWith('run.app');

  let primaryUrl = endpoint;
  if (!isAbsolute) {
    const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    if (customApiUrl) {
      primaryUrl = `${customApiUrl.replace(/\/$/, '')}${cleanPath}`;
    } else if (isExternalHost) {
      // Direct call to Cloud Run backend when running on external domains (e.g. Hostinger, sheikcoin.site)
      primaryUrl = `${CLOUD_RUN_API_URL.replace(/\/$/, '')}${cleanPath}`;
    } else {
      primaryUrl = cleanPath;
    }
  }

  // Attempt request with primary URL, and fallback to Cloud Run if primary relative request returns non-JSON or network error
  try {
    const res = await fetch(primaryUrl, options);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || `Erro na API (${res.status})`);
      }
      return data;
    }

    // If primary returned non-JSON (e.g. 404 index.html on static Hostinger site) and we haven't tried Cloud Run directly yet
    if (!isAbsolute && !primaryUrl.startsWith(CLOUD_RUN_API_URL)) {
      const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
      const fallbackUrl = `${CLOUD_RUN_API_URL.replace(/\/$/, '')}${cleanPath}`;
      console.warn(`[fetchApi] Resposta não-JSON de ${primaryUrl}. Tentando fallback no Cloud Run: ${fallbackUrl}`);
      
      const fallbackRes = await fetch(fallbackUrl, options);
      const fallbackContentType = fallbackRes.headers.get('content-type') || '';
      
      if (fallbackContentType.includes('application/json')) {
        const fallbackData = await fallbackRes.json();
        if (!fallbackRes.ok) {
          throw new Error(fallbackData.details || fallbackData.error || `Erro na API (${fallbackRes.status})`);
        }
        return fallbackData;
      }
    }

    if (!res.ok) {
      throw new Error(`Erro de comunicação com o servidor (${res.status}).`);
    }

    throw new Error('Resposta do servidor em formato inesperado (não é JSON).');
  } catch (err: any) {
    // If network error occurred on relative URL, try Cloud Run as last resort
    if (!isAbsolute && !primaryUrl.startsWith(CLOUD_RUN_API_URL)) {
      try {
        const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const fallbackUrl = `${CLOUD_RUN_API_URL.replace(/\/$/, '')}${cleanPath}`;
        console.warn(`[fetchApi Network Retry] Tentando Cloud Run backend em ${fallbackUrl}`);
        
        const retryRes = await fetch(fallbackUrl, options);
        const retryContentType = retryRes.headers.get('content-type') || '';
        
        if (retryContentType.includes('application/json')) {
          const retryData = await retryRes.json();
          if (!retryRes.ok) {
            throw new Error(retryData.details || retryData.error || `Erro na API (${retryRes.status})`);
          }
          return retryData;
        }
      } catch (retryErr: any) {
        console.error('[fetchApi Cloud Run Fallback Error]:', retryErr);
      }
    }

    console.error('[fetchApi Error]:', err);
    throw err;
  }
}



