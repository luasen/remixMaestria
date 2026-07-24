// Helper to perform API requests with fallback to Cloud Run server if hosted statically on Hostinger or custom domain
const CLOUD_RUN_BACKEND = 'https://ais-pre-mspmaj3jr76kak5lfjtw3r-421365387983.us-west1.run.app';

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  const path = isAbsolute ? endpoint : (endpoint.startsWith('/') ? endpoint : '/' + endpoint);

  // If already absolute URL
  if (isAbsolute) {
    const res = await fetch(path, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || `Erro na requisição (${res.status})`);
      }
      return data;
    }
    throw new Error('Servidor retornou formato não-JSON.');
  }

  // 1. Try relative path on current host
  try {
    const res = await fetch(path, options);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[fetchApi] Chamada relativa falhou, tentando servidor principal...', err);
  }

  // 2. Fallback to Cloud Run backend URL if host is serving static HTML (e.g. Hostinger sheikcoin.site)
  const fallbackUrl = `${CLOUD_RUN_BACKEND}${path}`;
  const res = await fetch(fallbackUrl, options);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.details || data.error || `Erro HTTP ${res.status}`);
    }
    return data;
  }

  throw new Error('Servidor de pagamentos temporariamente indisponível. Tente novamente em alguns segundos.');
}
