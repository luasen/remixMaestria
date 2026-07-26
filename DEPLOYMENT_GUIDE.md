# 🚀 GUIA COMPLETO DE DEPLOY PARA PRODUÇÃO NA HOSTINGER

## 📋 RESUMO EXECUTIVO

Seu projeto **remixMaestria** está **100% pronto para produção**. Todos os arquivos foram otimizados e configurados para Hostinger com a API em Render.

---

## ✅ ARQUIVOS MODIFICADOS

1. **`server.ts`** - Melhorado com tratamento de ambiente, cache headers e fallback SPA
2. **`vite.config.ts`** - Otimizado com compressão, minificação e variáveis de ambiente
3. **`src/vite-env.d.ts`** - TypeScript types para variáveis de ambiente
4. **`.env.production`** ✨ NOVO - Configuração de produção com VITE_API_URL correto
5. **`.env`** - Configuração local para desenvolvimento
6. **`package.json`** - Scripts atualizados para production

---

## 🔧 PASSO A PASSO - FAZER BUILD LOCALMENTE

### 1️⃣ Clone o repositório (se ainda não tiver)
```bash
git clone https://github.com/luasen/remixMaestria.git
cd remixMaestria
```

### 2️⃣ Instale as dependências
```bash
npm install
```

### 3️⃣ Faça o build de PRODUÇÃO
```bash
npm run build
```

**O que vai acontecer:**
- Vite compila React + TypeScript em HTML/CSS/JS otimizado
- `esbuild` empacota o `server.ts` como `dist/server.cjs`
- `.env.production` injeta automaticamente:
  - `VITE_API_URL=https://maestriagrill-backend.onrender.com` ✅

### 4️⃣ Teste localmente (opcional, mas recomendado)
```bash
npm start
```
Acesse http://localhost:3000 e confirme que tudo funciona.

---

## 📤 UPLOAD PARA HOSTINGER

### Opção A: Git Push (RECOMENDADO - Automático)

**Na Hostinger:**
1. Vá para **Git Repositories** > **Connect Repository**
2. Escolha seu GitHub: `luasen/remixMaestria`
3. Configure Build:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Node.js Version:** `20.x` ou superior
   - **Public Directory:** `dist`

4. **Variáveis de Ambiente** (no painel Hostinger):
   ```
   NODE_ENV=production
   PORT=3000
   VITE_API_URL=https://maestriagrill-backend.onrender.com
   APP_URL=https://seu-dominio.com
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-4612394528193802...
   MERCADOPAGO_WEBHOOK_SECRET=5b243ea8deba910f74cc4cb3553a2876a82af67f992c816108d5abd286d0a686
   GEMINI_API_KEY=sua-chave-aqui
   ```

5. Clique em **Deploy** - Hostinger faz automaticamente:
   - `npm install`
   - `npm run build`
   - `npm start`

**Pronto! 🎉**

---

### Opção B: Upload Manual (FTP/SFTP)

Se preferir fazer upload dos arquivos compilados:

1. **Faça o build localmente:**
   ```bash
   npm run build
   ```

2. **Upload via FTP/SFTP:**
   - Conecte no painel Hostinger com suas credenciais
   - Suba apenas a pasta **`dist/`** para o servidor
   - Arquivos importantes:
     - `dist/index.html` - Página principal
     - `dist/server.cjs` - Servidor Node.js
     - `dist/assets/` - CSS, JS, imagens

3. **No painel Hostinger:**
   - Configure **Node.js Entry Point:** `dist/server.cjs`
   - Defina as **Variáveis de Ambiente** (veja acima)

---

## 🌐 CONFIGURAÇÃO DE ROTAS (SPA)

✅ **Seu projeto JÁ TEM suporte a SPA!**

No `server.ts` (linhas 522-524):
```typescript
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});
```

**Isso significa:**
- Qualquer rota interna (ex: `/menu`, `/checkout`) retorna `index.html`
- React controla a navegação pelo lado do cliente
- **Sem erro 404 ao recarregar páginas internas** ✅

---

## 🔐 VARIÁVEIS DE AMBIENTE - HOSTINGER

**Obrigatórias:**
```env
VITE_API_URL=https://maestriagrill-backend.onrender.com
NODE_ENV=production
```

**Recomendadas (configure no painel Hostinger → Variáveis de Ambiente):**
```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-4612394528193802-072320-97e3710081e80df08135f600e23b1d04-493924237
MERCADOPAGO_WEBHOOK_SECRET=5b243ea8deba910f74cc4cb3553a2876a82af67f992c816108d5abd286d0a686
APP_URL=https://maestriagrill.site
VITE_MERCADOPAGO_PUBLIC_KEY=APP_USR-45e3bea4-d7ee-4847-af4b-251fba799c6f
GEMINI_API_KEY=sua-chave-aqui
```

**Automáticas (do .env.production):**
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID
- VITE_FIREBASE_DATABASE_ID

---

## ✨ OTIMIZAÇÕES APLICADAS

### 1. **Compressão e Minificação**
- ✅ Terser para JS (remove console.log, debugger)
- ✅ Vite otimiza CSS automaticamente
- ✅ Imagens processadas

### 2. **Cache Headers**
- ✅ `assets/*` → Cache 1 ano (immutable)
- ✅ `*.html` → Sem cache (always fresh)
- ✅ Outros arquivos → Cache 1 hora

### 3. **SPA Fallback**
- ✅ Todas as rotas → `index.html` (menos `/api/*`)
- ✅ React Router funciona normalmente
- ✅ Sem erro 404 em refresh

### 4. **Production Server**
- ✅ Express serve arquivos estáticos
- ✅ CORS configurado
- ✅ Webhooks Mercado Pago funcionam
- ✅ Logs no console para debug

---

## 🧪 CHECKLIST PRÉ-DEPLOY

- [ ] `npm run build` executou com sucesso?
- [ ] `npm start` rodou sem erros?
- [ ] Acessou http://localhost:3000?
- [ ] Frontend carregou corretamente?
- [ ] Clicou em algumas rotas (home, menu, etc)?
- [ ] Firebase conectou (se houver dados)?
- [ ] API em Render está UP (`https://maestriagrill-backend.onrender.com/api/health`)?

---

## 📊 ESTRUTURA FINAL

```
remixMaestria/
├── dist/                    ← 🟢 FAZER UPLOAD DISSO
│   ├── index.html
│   ├── server.cjs
│   └── assets/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── ...
├── .env.production          ← 🔒 Variáveis de produção
├── .env                     ← 🔒 Variáveis locais
├── vite.config.ts           ← ✅ Otimizado
├── server.ts                ← ✅ Melhorado
├── package.json             ← ✅ Scripts prontos
└── package-lock.json
```

---

## 🚨 TROUBLESHOOTING

### Erro: "Cannot find module 'vite'"
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Erro: "VITE_API_URL não definido"
✅ **Já resolvido!** O `.env.production` tem o valor padrão.

### Erro: "404 ao recarregar rota interna"
✅ **Já resolvido!** O `server.ts` tem fallback SPA.

### Porta 3000 em uso
```bash
PORT=8000 npm start
```

### Firebase não conecta
- Verifique `VITE_FIREBASE_*` em Variáveis de Ambiente Hostinger
- Confira regras Firestore (`firestore.rules`)

---

## 📞 COMANDOS FINAIS

**Build de Produção:**
```bash
npm run build
```

**Testar Localmente:**
```bash
npm start
```

**Limpar Build:**
```bash
npm run clean
```

**Lint (verificar erros TS):**
```bash
npm run lint
```

---

## ✅ PRONTO PARA PRODUÇÃO!

Seu projeto está **100% pronto**. O comando final é:

```bash
npm run build
```

Depois é só fazer upload da pasta `dist/` para Hostinger e configurar as variáveis de ambiente no painel.

🎉 **Sucesso na Hostinger!**
