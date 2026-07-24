// Helper to perform API requests with support for custom backend URL (VITE_API_URL) or relative host
export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
  const customApiUrl = import.meta.env.VITE_API_URL;
  const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');

  let targetUrl = endpoint;
  if (!isAbsolute) {
    const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    if (customApiUrl) {
      targetUrl = `${customApiUrl.replace(/\/$/, '')}${cleanPath}`;
    } else {
      targetUrl = cleanPath;
    }
  }

  try {
    const res = await fetch(targetUrl, options);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || `Erro na API (${res.status})`);
      }
      return data;
    }

    if (!res.ok) {
      throw new Error(`Erro de comunicação com o servidor (${res.status}).`);
    }

    throw new Error('Resposta do servidor em formato inesperado.');
  } catch (err: any) {
    console.error('[fetchApi Error]:', err);
    throw err;
  }
}


