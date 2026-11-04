# Radar de Vagas

Painel pessoal em Next.js para ler feeds RSS/Atom públicos de vagas, aplicar palavras desejadas/bloqueadas e cidades, salvar no Supabase e alertar pelo Telegram. A candidatura continua manual.

## Recursos
- Login administrativo simples com cookie assinado
- Filtros editáveis no painel
- Pontuação e bloqueios
- Fontes RSS/Atom adicionadas pelo painel
- RioVagas pré-configurado por RSS
- Histórico e deduplicação por URL
- Telegram e execução manual
- Vercel Cron diário

## 1. Supabase
1. Crie um projeto.
2. Abra o SQL Editor e execute `supabase/schema.sql`.
3. Copie a URL e a chave `service_role` para as variáveis de ambiente. A chave service role deve ficar somente no servidor.

## 2. Telegram
1. Converse com `@BotFather`, use `/newbot` e copie o token.
2. Envie uma mensagem ao bot.
3. Consulte `https://api.telegram.org/botSEU_TOKEN/getUpdates` e copie `message.chat.id`.
4. Cadastre token e chat ID no Vercel, nunca no GitHub.

## 3. Local
```bash
cp .env.example .env.local
npm install
npm run dev
```
Abra `http://localhost:3000` e entre com `ADMIN_PASSWORD`.

## 4. GitHub e Vercel
1. Crie um repositório e envie estes arquivos.
2. Importe o repositório no Vercel.
3. Cadastre todas as variáveis de `.env.example`.
4. Faça o deploy.

O `vercel.json` agenda uma busca diária às 12:00 UTC. No plano Hobby, o cron não pode executar mais de uma vez por dia. Você também pode usar “Buscar agora” no painel.

## Fontes como Vagas.com e Sólides
Este projeto aceita feeds RSS/Atom ou APIs/feed autorizados. Não inclui automação de login, CAPTCHA, rotação de IP nem scraping de páginas proibidas. Para Vagas.com, a API de Feed de Vagas é uma solução empresarial e suas condições precisam ser verificadas com o suporte. Para Sólides, adicione somente um feed público/autorizado disponibilizado pela empresa ou pelo portal da contratante.

## Segurança
- Nunca versione `.env.local`.
- Use senhas e segredos longos.
- O endpoint de cron exige `CRON_SECRET`.
- O banco usa RLS; o app acessa com chave de servidor.
- Antes de adicionar uma fonte, confira termos, robots.txt e limites.

## Limites
Seletores HTML de sites mudam e portais podem proibir automação. Por isso, esta primeira versão usa feeds públicos. Google Vagas não foi integrado diretamente: o produto público de busca não oferece neste projeto um feed de resultados. A Cloud Talent Solution é voltada a vagas cadastradas no projeto do cliente, não um acesso geral aos resultados exibidos pelo Google.
