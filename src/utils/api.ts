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
        throw new Error(data.details || data.error || `Erro HTTP ${res.status}`);
      }
      return data;
    }

    // If server returned non-JSON (e.g. 404 HTML from static hosting)
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(
          'Servidor Node.js de pagamentos não encontrado. Certifique-se de que o backend (node dist/server.cjs) está rodando na Hostinger.'
        );
      }
      throw new Error(`Servidor respondeu com código ${res.status}.`);
    }

    throw new Error('Servidor respondeu num formato inválido (esperava-se JSON).');
  } catch (err: any) {
    console.error('[fetchApi Error]:', err);
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(
        'Falha de conexão com o servidor de pagamentos. Verifique se o backend Node.js está rodando ou se há bloqueio de CORS.'
      );
    }
    throw err;
  }
}

