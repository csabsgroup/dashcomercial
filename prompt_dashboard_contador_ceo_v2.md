# Prompt Completo — Dashboard Comercial Contador CEO (v2)
> **Destino:** GitHub Copilot Agent  
> **Stack:** React 18 + Vite 5 + TypeScript + Supabase + React Router 7  
> **Deploy:** SPA estática via FTP em hospedagem compartilhada (LiteSpeed/Apache)  
> **Versão:** 2.0 — Integração PipeRun corrigida conforme documentação oficial (https://developers.pipe.run)

---

## 1. VISÃO GERAL DO PROJETO

Desenvolva um **Dashboard Comercial completo** chamado **"Ranking de Vendas Contador CEO"** para a empresa **ABS Group** (`@absgroup.com.br`).

O sistema é uma SPA (Single Page Application) React que:
- Consome dados da **API do PipeRun** (CRM) via **Supabase Edge Functions** (proxy server-side) — o frontend NUNCA chama a API do PipeRun diretamente
- Armazena dados sincronizados, metas, usuários e configurações no **Supabase** (PostgreSQL + Auth + RLS + Realtime)
- Recebe atualizações em tempo real via **Supabase Realtime** (o frontend escuta mudanças no banco, não faz polling direto ao PipeRun)
- É deployada como arquivos estáticos via FTP conforme o guia de deploy da equipe
- Tem autenticação restrita ao domínio `@absgroup.com.br`
- É totalmente **responsiva** (mobile-first, funciona em tablet e desktop)
- Tem **Dark Mode e Light Mode** com toggle (padrão: dark mode)

**Identidade Visual:**
- Tema escuro predominante (fundo #0d0d0d / #111, superfícies #1a1a1a)
- Cores de destaque: dourado (#f5c518), verde (#00c853), vermelho (#f44336)
- Estilo inspirado em ranking de games / esportes
- Logo da empresa "Contador CEO" deve aparecer no header

---

## 2. STACK TÉCNICA COMPLETA

```
Frontend:
  - React 18
  - Vite 5
  - TypeScript 5
  - React Router 7 (BrowserRouter)
  - Tailwind CSS v4
  - Framer Motion (animações do ranking)
  - Recharts (gráficos)
  - date-fns (manipulação de datas)
  - Lucide React (ícones)

Backend (BaaS):
  - Supabase (PostgreSQL + Auth + RLS + Realtime + Edge Functions)
  - Tabelas principais: user_profiles, goals, piperun_config, 
    piperun_deals_cache, piperun_activities_cache, ranking_snapshots,
    sync_log, notifications
  - Edge Functions: sync-piperun (proxy + sincronização)

Integração (ARQUITETURA CORRIGIDA):
  - API REST do PipeRun v1.1 — URL base: https://api.pipe.run/v1
  - Autenticação: Header "Token: <token>" (NÃO é Bearer)
  - Chamadas feitas APENAS via Supabase Edge Functions (server-side)
  - Sync incremental a cada 2-5 minutos via Edge Function (cron)
  - Frontend lê APENAS do Supabase via Realtime subscriptions
  - Token do PipeRun armazenado como Supabase Secret (nunca exposto ao frontend)

Deploy:
  - Build: npm run build → /dist
  - Upload via FTP para public_html/
  - Arquivo public/_redirects: /* /index.html 200
  - Arquivo public/.htaccess para fallback Apache/LiteSpeed
```

**Variáveis de Ambiente — Frontend (.env.local):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ALLOWED_DOMAIN=absgroup.com.br
```

> ⚠️ IMPORTANTE: NÃO colocar VITE_PIPERUN_API_TOKEN no frontend.
> O token do PipeRun fica como Secret na Supabase Edge Function.
> Variáveis VITE_* são expostas no bundle JavaScript — qualquer pessoa com DevTools consegue ver.

**Variáveis de Ambiente — Supabase Edge Functions (Secrets):**
```
PIPERUN_API_TOKEN=<token do PipeRun>
PIPERUN_BASE_URL=https://api.pipe.run/v1
```

---

## 3. AUTENTICAÇÃO E CONTROLE DE ACESSO

### 3.1 Regras de Autenticação
- Login via **e-mail e senha** usando Supabase Auth
- **Apenas e-mails do domínio `@absgroup.com.br`** são aceitos
- Validação no frontend: se o e-mail não terminar em `@absgroup.com.br`, bloquear o login com mensagem clara
- Reforçar no Supabase via Hook ou trigger: bloquear signup de domínios externos
- Sessão persistida via localStorage do Supabase (JWT)
- Logout automático após 8 horas de inatividade

### 3.2 Perfis de Usuário
Crie a tabela `user_profiles` no Supabase com os campos:
```sql
id (UUID, FK auth.users)
name (TEXT)
email (TEXT)
role (ENUM: 'master', 'admin', 'closer', 'sdr')
avatar_url (TEXT, nullable)
piperun_user_id (INTEGER, nullable) -- ID do usuário no PipeRun
active (BOOLEAN, default true)
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)
```

### 3.3 Seed de Admin Inicial
Na primeira instalação, criar automaticamente um usuário Master via seed SQL:
```sql
-- Executar uma única vez após setup do Supabase Auth
-- O admin deve fazer signup primeiro em /login, depois rodar este UPDATE:
UPDATE user_profiles 
SET role = 'master' 
WHERE email = 'admin@absgroup.com.br';
```
Alternativamente, criar uma rota `/setup` que só funciona quando não existe nenhum usuário Master no sistema — permite ao primeiro usuário se registrar como Master.

### 3.4 Matriz de Permissões

| Funcionalidade | Master | Admin | Closer | SDR |
|---|---|---|---|---|
| Ver dashboard próprio | ✅ | ✅ | ✅ | ✅ |
| Ver dados de todos usuários | ✅ | ✅ | ❌ | ❌ |
| Ver ranking completo | ✅ | ✅ | ✅ | ✅ |
| Closers podem ver dados de SDR | ✅ | ✅ | ✅ | ❌ |
| SDRs podem ver dados de Closer | ✅ | ✅ | ❌ | ✅ |
| Configurar metas | ✅ | ✅ | ❌ | ❌ |
| CRUD de usuários | ✅ | ✅ | ❌ | ❌ |
| Configurar integração PipeRun | ✅ | ✅ | ❌ | ❌ |
| Configurar visões do dashboard | ✅ | ✅ | ❌ | ❌ |
| Criar outros Masters | ✅ | ❌ | ❌ | ❌ |

---

## 4. ESTRUTURA DE ROTAS E NAVEGAÇÃO

```
/ → Redirect para /login (ou /dashboard se autenticado)
/login → Tela de login
/setup → Wizard de primeira configuração (só aparece se não há Master)
/dashboard → Dashboard principal (protegido)
/ranking → Tela de Ranking Gamificado (protegido)
/metas → Visão de metas e progresso (protegido)
/configuracoes → Configurações gerais (apenas Master/Admin)
/configuracoes/usuarios → CRUD de usuários
/configuracoes/metas → Gestão de metas
/configuracoes/piperun → Integração com PipeRun
/configuracoes/dashboard → Configurar visões do dashboard
/perfil → Perfil do usuário logado
```

Implemente `ProtectedRoute` com verificação de role. Redirecionar para `/login` se não autenticado.

---

## 5. LAYOUT GERAL DO DASHBOARD

### 5.1 Sidebar de Navegação (Desktop)
- Lateral esquerda, colapsável (ícone + texto)
- Logo "Contador CEO" no topo
- Itens de menu com ícones Lucide:
  - 📊 Dashboard
  - 🏆 Ranking
  - 🎯 Metas
  - ⚙️ Configurações (apenas Master/Admin)
  - 👤 Perfil
  - 🚪 Sair
- Role badge exibido abaixo do nome do usuário
- Avatar do usuário

### 5.2 Header
- Nome da página atual
- Seletor de período (estilo Google Looker Studio: data início → data fim, com atalhos: Hoje, Esta semana, Este mês, Trimestre atual, Ano atual, Personalizado)
- Indicador de sincronização: 🟢 "Sincronizado" | 🟡 "Sincronizando..." | 🔴 "Erro de sync"
- Timestamp "Última sync: HH:MM:SS"
- Botão toggle Dark/Light mode
- Notificações (sino com badge)
- Avatar do usuário logado

### 5.3 Mobile
- Bottom navigation bar com 4 itens principais
- Sidebar vira drawer (hamburger menu)
- Cards de KPI em coluna única
- Gráficos 100% da largura

---

## 6. DASHBOARD PRINCIPAL — INDICADORES

O dashboard é dividido em **abas** ou **seções**: `Visão Geral`, `SDR`, `Closer`.

O **Master/Admin** configura em `/configuracoes/dashboard` quais funis do PipeRun alimentam cada seção e quais campos aparecem.

### 6.1 Seção: Visão Geral (topo do dashboard)

**KPI Cards de destaque (linha superior):**
- 💰 **Meta de Faturamento Mês** — Meta | Realizado | Gap | % atingido
- 💵 **Meta de Entrada Mês** — Meta | Realizado | Gap | % atingido  
- 📈 **MRR Gerado** — (Valor total do contrato / 12)
- 📅 **Previsão do Mês** — Valor previsto vs realizado vs gap
- 🔥 **Pipeline Total** — Valor total em aberto
- 📊 **Cobertura de Pipeline** — Pipeline / Meta (regra: saudável = 3x a meta)

> ⚠️ IMPORTANTE: Cada KPI card deve ter:
> - Valor atual em destaque (grande, animado ao carregar)
> - Barra de progresso colorida (verde ≥ 90%, amarelo 60-89%, vermelho < 60%)
> - Comparativo com período anterior (seta + percentual)
> - Indicador de alerta se abaixo de 70% do esperado proporcional ao período

### 6.2 Seção SDR — Métricas Completas

Funil configurável: **Contador CEO | SDR (NOVO)**

**Bloco: Volume e Atividade**
- Leads recebidos (total de oportunidades no funil SDR no período)
- Leads trabalhados (oportunidades com pelo menos 1 atividade registrada — cruzar `piperun_deals_cache` com `piperun_activities_cache` por `deal_id`)
- Cadência média por lead (média de atividades por oportunidade)
- Tempo médio de primeiro contato — SLA (horas entre `created_at` do deal e `created_at` da 1ª atividade vinculada)

**Bloco: Conversão e Qualificação**
- Taxa de contato = Leads com atividade / Total de leads × 100
- Taxa de qualificação = Leads que avançaram para etapa de qualificação / Leads totais × 100 (baseado na etapa do funil — `stage_id`)
- Taxa de agendamento = Oportunidades que chegaram à etapa de agendamento / Total de leads × 100
- Show rate = Reuniões realizadas / Reuniões agendadas × 100 (baseado em tipo de atividade "reunião" com status concluído)

**Bloco: Eficiência (por SDR)**
- Leads por SDR (filtrar por `user_id` do deal no PipeRun)
- Reuniões agendadas por SDR
- Tempo médio até agendamento (dias entre criação e mudança para etapa de agendamento)

**Bloco: Qualidade**
- Taxa de avanço SDR → Closer (% de oportunidades do funil SDR que foram duplicadas/movidas para o funil Closer — detectar pelo campo `origin_deal_id` ou por oportunidade com mesma empresa/pessoa no funil Closer)
- Taxa de ganho por origem (campo `origin_id` da oportunidade no PipeRun — usar endpoint `/origins`)

**Diagnóstico Automático (cards de alerta):**
- Se taxa de qualificação < 20%: mostrar alerta "Revisar ICP ou preparação do SDR"
- Se show rate < 70%: mostrar alerta "Revisar expectativa e confirmação de reuniões"
- Se volume < meta de leads: mostrar alerta "Verificar canal de marketing"

**Gráficos da seção SDR:**
- Gráfico de funil: Leads → Trabalhados → Qualificados → Agendados → Realizados (baseado nas etapas do funil SDR no PipeRun)
- Gráfico de linha: Evolução diária de leads e reuniões no período
- Gráfico de barras horizontais: Comparativo por SDR (leads, reuniões, taxa)

### 6.3 Seção Closer — Métricas Completas

Funil configurável: **Contador CEO | CLOSER (NOVO)**

**Bloco: Conversão de Vendas**
- Taxa de conversão = Vendas (deals status "won") / Reuniões realizadas × 100
- Taxa de ganho = Deals com `status = "won"` / Total de oportunidades no período × 100
- Taxa de perda = Deals com `status = "lost"` / Total de oportunidades × 100

**Bloco: Receita**
- Receita gerada = soma do campo mapeado como "Valor de Faturamento" dos deals ganhos (campo customizado via `customForms` — ver seção 10.4)
- Valor de entrada gerado = soma do campo mapeado como "Valor de Entrada" dos deals ganhos
- MRR gerado = Receita total / 12
- Ticket médio = Receita total / nº de vendas
- Receita por vendedor (breakdown por `user_id` do Closer)

**Bloco: Pipeline e Forecast**
- Valor total do pipeline = soma do `value` dos deals em aberto (`status = "open"`)
- Cobertura de pipeline = Pipeline / Meta (indicar se < 3x: alerta)
- Tempo médio de fechamento — ciclo de vendas = média de dias entre `created_at` e `last_stage_updated_at` dos deals ganhos
- Previsão do mês = valor previsto vs realizado vs gap

**Bloco: Eficiência Comercial**
- Receita por reunião = Receita total / Reuniões realizadas
- Win rate por origem do lead (cruzar `origin_id` do deal com endpoint `/origins`)
- Tempo médio por deal (dias)

**Bloco: Qualidade**
- Motivos de perda = campo `lost_reason_id` dos deals perdidos — buscar nomes via `/lost-reasons` (gráfico de pizza/donut)
- Taxa de desconto (se houver campo customizado de valor original vs valor final)
- Quantidade de follow-ups até fechar (média de atividades nos deals ganhos — contar registros em `piperun_activities_cache` por `deal_id`)

**Gráficos da seção Closer:**
- Gráfico de funil: Reuniões → Propostas → Negociação → Ganho/Perda (baseado nas etapas do funil Closer)
- Gráfico de linha: Evolução de receita diária/semanal no período
- Gráfico de barras: Receita e tickets por Closer
- Gráfico de pizza/donut: Motivos de perda
- Gráfico de barras agrupadas: Meta vs Realizado por closer (faturamento + entrada)

---

## 7. TELA DE RANKING GAMIFICADO

Esta tela é especial. Deve ter o visual de um ranking de games/esportes (tema dark, dourado, pódio, badges de posição).

### 7.1 Layout da Tela de Ranking

**Aba 1: Ranking de Closers**
**Aba 2: Ranking de SDRs**

Cada aba tem:
- **Painel esquerdo (60%):** Pódio visual (Top 3)
- **Painel direito (40%):** Lista completa com posições 1 a N

### 7.2 Pódio Visual (Top 3)
- Posição 1 (centro, mais alto): Badge dourado com coroa 👑, foto do closer em círculo, nome, valor
- Posição 2 (esquerda, médio): Badge prateado, foto, nome, valor
- Posição 3 (direita, menor): Badge bronze/vermelho, foto, nome, valor
- Acima de cada pódio: ícone do prêmio (ex: viagem, dinheiro, notebook) — configurável pelo ADM

### 7.3 Lista de Ranking (painel direito)
Para cada posição:
- Número da posição (estilizado)
- Avatar circular do vendedor
- Nome
- Meta | Total realizado
- Barra de progresso horizontal colorida
- Percentual atingido

Totais no topo da lista:
- Total do time (soma de todos)
- Total do Top 3

### 7.4 Ordenação Configurável
Selector dropdown na tela para ordenar por:
- 💰 Receita / Faturamento
- 📥 Valor de Entrada
- 📊 Número de Deals Fechados
- 🎯 Taxa de Conversão
- (SDR) 📅 Reuniões Agendadas
- (SDR) ✅ Leads Qualificados
- (SDR) 📈 Taxa de Agendamento

### 7.5 Animações do Ranking (OBRIGATÓRIO com Framer Motion)

**Animação de entrada inicial:**
- Cards entram de baixo para cima em sequência (stagger de 100ms entre posições)
- Contador numérico animado nos valores (count-up de 0 até o valor real)
- Barras de progresso crescem da esquerda para direita

**Animação de ultrapassagem (CRÍTICA):**
- Quando dados são atualizados (via Supabase Realtime) e um vendedor passa outro:
  1. Flash dourado no card que subiu de posição
  2. Card desliza para cima com spring animation (Framer Motion layout animation)
  3. Card que caiu de posição desliza para baixo
  4. Partículas/confetti dourado saem do card que subiu (Canvas ou CSS particles)
  5. Som de celebração (opcional — toggle de som on/off)
  6. Badge temporário "📈 Subiu!" aparece por 3 segundos no card que avançou

**Animação de liderança (1º lugar):**
- Card do 1º lugar tem brilho animado contínuo (glow pulsante em dourado)
- Coroa animada (bounce suave)
- Partículas douradas flutuando ao redor do card (loop suave)

**Atualização em tempo real:**
- Indicador "🔴 AO VIVO" piscando no header quando há Realtime subscription ativa
- Timestamp "Última sync: HH:MM:SS" (baseado no `sync_log`)
- O ranking deve manter estado anterior (snapshot) para detectar mudanças de posição

### 7.6 Período do Ranking
- Sempre mostra o **mês vigente** por padrão
- Filtro de período igual ao header geral (Looker Studio style)

---

## 8. TELA DE METAS

### 8.1 Visualização de Metas (todos os usuários)
- Cards de progresso para cada meta configurada:
  - Meta Anual | Realizado | Gap | % atingido | Previsão de fechamento
  - Meta Trimestral atual | Realizado | Gap | % atingido
  - Meta Mensal atual | Realizado | Gap | % atingido
- Gráfico de linha: Evolução mensal de realizado vs meta ao longo do ano
- Gráfico de barras: Metas mensais com realizado sobreposto
- Tabela: Breakdown por closer (meta individual vs realizado)

### 8.2 Alerta de Gap (Contador de Previsão)
Card especial em destaque:
```
┌─────────────────────────────────────────────┐
│ 📊 FORECAST DO MÊS                          │
│                                             │
│ Previsto até hoje:    R$ 150.000            │
│ Realizado até hoje:   R$ 127.000            │
│ Gap:                  R$ -23.000 ⚠️         │
│ Necessário restante:  R$ 48.000             │
│ Dias úteis restantes: 8                     │
└─────────────────────────────────────────────┘
```

---

## 9. CONFIGURAÇÕES — TELA COMPLETA

### 9.1 Configuração de Metas (`/configuracoes/metas`)

**Meta Anual:**
- Campo: Valor total do ano (Faturamento)
- Campo: Valor total do ano (Entrada)
- Ao salvar, calcular automaticamente:
  - Meta trimestral = Anual / 4 (editável)
  - Meta mensal = Trimestral / 3 (editável individualmente)

**Balanceamento Mensal:**
- Grid de 12 meses com campo de valor individual para cada mês
- Ao alterar um mês, recalcular percentuais automático
- Validação: soma dos 12 meses deve igualar a meta anual (mostrar diferença em tempo real)
- Botão "Distribuir igualmente" (reset para Anual / 12)

**Meta por Closer:**
- Tabela com lista de Closers
- Para cada Closer: meta mensal, meta trimestral, meta anual (auto-calculada)
- Validação: soma das metas individuais deve bater com a meta do time

**Meta do SDR:**
- Reuniões agendadas por mês (por SDR e total)
- Leads qualificados por mês (por SDR e total)

### 9.2 CRUD de Usuários (`/configuracoes/usuarios`)

**Listagem:**
- Tabela com: Avatar | Nome | E-mail | Role | Vinculado PipeRun (✅/❌) | Status | Ações
- Filtro por role e status
- Busca por nome/email
- Badge colorido por role: Master (roxo), Admin (azul), Closer (verde), SDR (laranja)

**Criar usuário:**
- Modal com formulário:
  - Nome completo (obrigatório)
  - E-mail `@absgroup.com.br` (obrigatório, validado)
  - Senha temporária (obrigatório, mínimo 8 chars)
  - Role (select)
  - Upload de avatar (opcional)
  - Vincular ao PipeRun: select dropdown com lista de usuários do PipeRun (buscar via Edge Function que chama `GET /users` do PipeRun). Exibir nome + email do PipeRun. Salvar o `id` do PipeRun no campo `piperun_user_id`.
- Criar no Supabase Auth + inserir em `user_profiles`

**Editar usuário:**
- Mesmo modal com campos preenchidos
- Não permite alterar o próprio role (evitar lock-out)
- Botão "Redefinir senha" (envia email de reset pelo Supabase)

**Desativar/Ativar usuário:**
- Toggle de status (não deletar, apenas `active = false`)
- Confirmação antes de desativar

**Deletar usuário:**
- Apenas Master pode deletar
- Confirmação com digitação do e-mail para confirmar
- Remove de `user_profiles` e desativa no Supabase Auth

### 9.3 Integração com PipeRun (`/configuracoes/piperun`)

**Status da Conexão (card no topo):**
- Indicador visual: 🟢 Conectado | 🔴 Desconectado
- Última sincronização bem-sucedida: data/hora
- Próxima sincronização: data/hora
- Total de deals sincronizados / Total de atividades
- Botão "Forçar Sincronização Agora"

**Configuração do Token:**
- Campo de token (password, masked)
- Botão "Testar Conexão" — chama Edge Function que faz `GET https://api.pipe.run/v1` com o token e retorna `account_id`, `user_email`, `user_acl`
- Se bem-sucedido: salvar token criptografado na tabela `piperun_config` e atualizar o Supabase Secret
- Exibir: Nome da conta, Email do usuário do token, Nível de acesso (G1/C1)

**Configuração de Funis:**
- Após conexão bem-sucedida, listar todos os funis via Edge Function que chama `GET /pipelines`
- Para cada funil: checkbox para ativar no sistema
- Nome de exibição personalizado (ex: "Contador CEO | CLOSER (NOVO)")
- Selector de tipo: "SDR" ou "Closer" — define qual funil alimenta qual seção do dashboard

**Configuração de Etapas:**
- Para cada funil ativo, listar etapas via `GET /stages?pipeline_id={id}`
- Permitir mapear qual etapa corresponde a cada status lógico:
  - Etapa de "Qualificação" (para cálculo de taxa de qualificação SDR)
  - Etapa de "Agendamento" (para cálculo de reuniões agendadas)
  - Etapa de "Reunião Realizada" (para show rate)
  - Etapa de "Proposta Enviada" (para funil Closer)
  - Etapa de "Negociação" (para funil Closer)
- Isso é essencial porque cada conta PipeRun tem etapas customizadas

**Mapeamento de Campos Customizados:**
- Para cada funil ativo, listar campos customizados via `GET /custom-fields?pipeline_id={id}` (ou `GET /deals?with=customForms&show=1` para descobrir os formulários vinculados)
- Permitir identificar campos especiais com um select "Este campo é":
  - "Valor de Faturamento" (valor total do contrato)
  - "Valor de Entrada" (30-40% do contrato)
  - "Origem do Lead" (ou usar o `origin_id` nativo)
  - "Plano contratado" (Start/Aceleração/Elite)
  - "Nenhum / Outro"
- Salvar os mapeamentos no JSONB `field_mappings` da tabela `piperun_config`

**Intervalo de Sincronização:**
- Selector: 2min, 5min, 10min, 15min (mínimo 2 minutos para respeitar rate limits)
- Indicador visual do status da última sync e próxima sync programada

### 9.4 Configuração do Dashboard (`/configuracoes/dashboard`)

Permite ao Master/Admin:
- Definir quais KPIs aparecem na Visão Geral (toggle por card)
- Definir quais blocos aparecem nas seções SDR e Closer
- Ordenar os blocos por drag-and-drop
- Definir qual funil alimenta cada seção (SDR → funil X, Closer → funil Y)
- Definir a métrica padrão de ordenação do Ranking (por role)

### 9.5 Wizard de Primeira Configuração (`/setup`)

Fluxo guiado para a primeira vez que o sistema é acessado:
1. **Passo 1:** Inserir token do PipeRun → testar conexão
2. **Passo 2:** Selecionar funis SDR e Closer da lista retornada
3. **Passo 3:** Mapear etapas chave de cada funil (qualificação, agendamento, etc.)
4. **Passo 4:** Mapear campos customizados (faturamento, entrada)
5. **Passo 5:** Definir metas anuais (faturamento + entrada)
6. **Passo 6:** Executar primeira sincronização completa
7. **Passo 7:** Pronto! Redirecionar para /dashboard

---

## 10. INTEGRAÇÃO COM A API DO PIPERUN — ESPECIFICAÇÃO TÉCNICA

> ⚠️ Esta seção foi construída com base na documentação oficial:
> https://developers.pipe.run/docs e https://developers.pipe.run/reference
> Versão da API: CRM 1.1

### 10.1 Informações Críticas da API

**URL base:** `https://api.pipe.run/v1`
> ❌ NÃO usar `https://app.pipe.run/v1` — esse é o frontend web, não a API.

**Autenticação:** Header `Token` (NÃO é Bearer)
```
curl -X GET https://api.pipe.run/v1 \
  -H "Token: SEU_TOKEN_AQUI" \
  -H "Accept: application/json"
```

**Rate Limit:** 120 requisições a cada 30 segundos
- Headers de resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Quando excedido: HTTP 429 + headers `Retry-After` e `X-RateLimit-Reset`
- Implementar: retry com backoff respeitando o `Retry-After` em segundos

**Paginação:** Cursor-based (page está sendo descontinuado)
```
// Primeira página
GET /deals?cursor=&show=200

// Resposta inclui:
{
  "data": [...],
  "meta": {
    "cursor": {
      "current": null,
      "prev": null,
      "next": "eyJpZCI6MTQ3MTMxMTEsIl9wb...",  // hash para próxima página
      "count": null
    }
  }
}

// Próxima página — usar meta.cursor.next
GET /deals?cursor=eyJpZCI6MTQ3MTMxMTEsIl9wb...&show=200

// Quando meta.cursor.next === null → não há mais páginas
```

**Parâmetros de paginação:**
- `show` — quantidade por página (min: 1, max: 200, default: 15). Usar `show=200` para maximizar dados por request.
- `cursor` — hash de continuidade. Usar `cursor=` (vazio) ou `cursor=1` na primeira chamada.

**Filtros de data:** formato `Y-m-d` ou `Y-m-d H:i:s`
```
// Deals criados em abril/2026
GET /deals?created_at_start=2026-04-01&created_at_end=2026-04-30&show=200&cursor=

// Deals atualizados desde a última sync (incremental)
GET /deals?updated_at_start=2026-04-17%2014%3A30%3A00&show=200&cursor=
```

**Relações (with):** Trazer dados relacionados na mesma request
```
// Deals com formulários customizados (campos custom)
GET /deals?with=customForms&show=200&cursor=
```
> ⚠️ BOAS PRÁTICAS: Evitar múltiplos `with` encadeados (ex: `with=customForms,companies,persons`).
> Isso pode estourar o timeout da API. Preferir requests separadas e relacionar por IDs localmente.

**Ordenação:**
```
GET /deals?sort=created_at&desc=true  // mais recentes primeiro
GET /deals?sort=value&desc=false      // menor valor primeiro
```

### 10.2 Endpoints Utilizados

```
# Validação de conexão
GET /                                    → Retorna versão da API, account_id, user info

# Funis e Etapas
GET /pipelines                           → Lista todos os funis da conta
GET /pipelines/{id}                      → Detalhes de um funil
GET /stages?pipeline_id={id}             → Etapas de um funil específico

# Oportunidades (deals)
GET /deals                               → Lista oportunidades (com filtros)
GET /deals/{id}                          → Detalhes de uma oportunidade
GET /deals?pipeline_id={id}              → Filtrar por funil
GET /deals?user_id={id}                  → Filtrar por responsável
GET /deals?status=won                    → Apenas deals ganhos
GET /deals?status=lost                   → Apenas deals perdidos
GET /deals?status=open                   → Deals em aberto
GET /deals?with=customForms              → Incluir campos customizados
GET /deals?created_at_start=YYYY-MM-DD   → Filtro por data de criação
GET /deals?updated_at_start=YYYY-MM-DD   → Filtro por data de atualização

# Atividades
GET /activities                          → Lista atividades (follow-ups, reuniões)
GET /activities?deal_id={id}             → Atividades de uma oportunidade
GET /activities?user_id={id}             → Atividades de um usuário

# Tipos de atividade
GET /activityTypes                       → Lista tipos (reunião, ligação, email, etc.)

# Motivos de perda
GET /lostReasons                         → Lista motivos de perda configurados

# Origens
GET /origins                             → Lista origens de oportunidade

# Campos customizados
GET /customFields                        → Lista campos customizados globais
GET /customFields?pipeline_id={id}       → Campos de um funil específico

# Pessoas e Empresas
GET /persons                             → Lista contatos (NÃO é /people)
GET /companies                           → Lista empresas

# Usuários do CRM
GET /users                               → Lista usuários da conta PipeRun

# Metas do PipeRun (se configuradas)
GET /goals                               → Metas avançadas
GET /goals/{id}/statistics               → Estatísticas de uma meta
```

### 10.3 Arquitetura de Sincronização (Sync + Cache)

O frontend NUNCA chama a API do PipeRun diretamente. A arquitetura é:

```
┌─────────────┐     Realtime      ┌──────────────┐    Edge Function    ┌─────────────┐
│  Frontend   │ ◄──────────────── │   Supabase   │ ──────────────────► │  PipeRun    │
│  (React)    │   subscriptions   │  (PostgreSQL) │   sync-piperun()   │  API v1.1   │
│             │                   │              │   a cada 2-5 min    │             │
│             │ ──── RPC ────────►│              │                     │             │
│             │  (forçar sync)    │              │                     │             │
└─────────────┘                   └──────────────┘                     └─────────────┘
```

**Fluxo de sincronização:**

1. **Carga inicial (full sync):** Na primeira vez ou quando configuração muda
   - Edge Function percorre todos os deals dos funis configurados com paginação por cursor (`show=200`)
   - Salva em `piperun_deals_cache` no Supabase
   - Percorre todas as atividades dos deals e salva em `piperun_activities_cache`
   - Registra timestamp em `sync_log`

2. **Sync incremental (a cada 2-5 minutos):**
   - Edge Function busca apenas deals com `updated_at_start` > última sync
   - UPSERT nos registros alterados no `piperun_deals_cache`
   - Busca atividades dos deals atualizados
   - Atualiza `sync_log` com timestamp + contagem

3. **Frontend:**
   - Lê dados APENAS das tabelas de cache do Supabase
   - Escuta mudanças via Supabase Realtime (`SUBSCRIBE` nas tabelas de cache)
   - Quando recebe update, recalcula métricas e atualiza UI com animações

4. **Sync manual:**
   - Botão "Forçar Sincronização" no frontend chama `supabase.functions.invoke('sync-piperun')`

### 10.4 Supabase Edge Function — sync-piperun

```typescript
// supabase/functions/sync-piperun/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PIPERUN_TOKEN = Deno.env.get("PIPERUN_API_TOKEN")!
const PIPERUN_BASE = Deno.env.get("PIPERUN_BASE_URL") || "https://api.pipe.run/v1"

// Cliente PipeRun com rate limit awareness
class PiperunClient {
  private remainingRequests = 120

  async get(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${PIPERUN_BASE}${endpoint}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    const response = await fetch(url.toString(), {
      headers: {
        "Token": PIPERUN_TOKEN,
        "Accept": "application/json"
      }
    })

    // Atualizar awareness do rate limit
    this.remainingRequests = parseInt(
      response.headers.get("X-RateLimit-Remaining") || "120"
    )

    // Se atingiu rate limit, esperar
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "5")
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      return this.get(endpoint, params) // retry
    }

    if (!response.ok) {
      throw new Error(`PipeRun API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Paginação automática com cursor
  async getAll(endpoint: string, params: Record<string, string> = {}): Promise<any[]> {
    let allData: any[] = []
    let cursor: string | null = ""

    while (cursor !== null) {
      // Throttle se restam poucas requests
      if (this.remainingRequests < 10) {
        await new Promise(resolve => setTimeout(resolve, 5000))
      }

      const response = await this.get(endpoint, {
        ...params,
        show: "200",
        cursor: cursor || ""
      })

      if (response.data) {
        allData = allData.concat(response.data)
      }

      cursor = response.meta?.cursor?.next ?? null
    }

    return allData
  }
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const piperun = new PiperunClient()

  try {
    // 1. Buscar configuração
    const { data: config } = await supabase
      .from("piperun_config")
      .select("*")
      .single()

    if (!config) {
      return new Response(JSON.stringify({ error: "PipeRun não configurado" }), { status: 400 })
    }

    // 2. Determinar se é full sync ou incremental
    const { data: lastSync } = await supabase
      .from("sync_log")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .single()

    const isIncremental = !!lastSync
    const syncParams: Record<string, string> = {}

    if (isIncremental && lastSync) {
      syncParams.updated_at_start = lastSync.synced_at
    }

    // 3. Sincronizar deals dos funis configurados
    const pipelineIds = [config.closer_pipeline_id, config.sdr_pipeline_id].filter(Boolean)
    let totalDeals = 0
    let totalActivities = 0

    for (const pipelineId of pipelineIds) {
      // Buscar deals com custom forms
      const deals = await piperun.getAll("/deals", {
        pipeline_id: String(pipelineId),
        with: "customForms",
        ...syncParams
      })

      // Transformar e salvar no cache
      const cacheRows = deals.map(deal => ({
        piperun_deal_id: deal.id,
        pipeline_id: deal.pipeline_id,
        stage_id: deal.stage_id,
        user_id: deal.user_id,
        status: deal.status,  // "open" | "won" | "lost"
        value: deal.value,
        title: deal.title,
        origin_id: deal.origin_id,
        lost_reason_id: deal.lost_reason_id,
        person_id: deal.person_id,
        company_id: deal.company_id,
        custom_fields: deal.customForms || deal.custom_fields || {},
        piperun_created_at: deal.created_at,
        piperun_updated_at: deal.updated_at,
        raw_data: deal,  // guardar JSON completo para debug
        synced_at: new Date().toISOString()
      }))

      if (cacheRows.length > 0) {
        await supabase
          .from("piperun_deals_cache")
          .upsert(cacheRows, { onConflict: "piperun_deal_id" })
        totalDeals += cacheRows.length
      }

      // 4. Sincronizar atividades dos deals atualizados
      const dealIds = deals.map(d => d.id)
      for (const dealId of dealIds) {
        const activities = await piperun.getAll("/activities", {
          deal_id: String(dealId)
        })

        const activityRows = activities.map(act => ({
          piperun_activity_id: act.id,
          deal_id: act.deal_id,
          user_id: act.user_id,
          activity_type_id: act.activity_type_id,
          status: act.status,
          title: act.title,
          piperun_created_at: act.created_at,
          piperun_updated_at: act.updated_at,
          synced_at: new Date().toISOString()
        }))

        if (activityRows.length > 0) {
          await supabase
            .from("piperun_activities_cache")
            .upsert(activityRows, { onConflict: "piperun_activity_id" })
          totalActivities += activityRows.length
        }
      }
    }

    // 5. Registrar sync
    await supabase.from("sync_log").insert({
      synced_at: new Date().toISOString(),
      sync_type: isIncremental ? "incremental" : "full",
      deals_synced: totalDeals,
      activities_synced: totalActivities,
      status: "success"
    })

    // 6. Gerar snapshot do ranking (para detectar mudanças de posição)
    // Chamar função SQL que calcula ranking e compara com snapshot anterior
    await supabase.rpc("generate_ranking_snapshot")

    return new Response(JSON.stringify({
      success: true,
      sync_type: isIncremental ? "incremental" : "full",
      deals_synced: totalDeals,
      activities_synced: totalActivities
    }))

  } catch (error) {
    // Registrar erro no sync_log
    await supabase.from("sync_log").insert({
      synced_at: new Date().toISOString(),
      sync_type: "error",
      status: "error",
      error_message: error.message
    })

    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

### 10.5 Edge Function — proxy-piperun (para chamadas on-demand)

Para chamadas pontuais do frontend (ex: listar funis na configuração, listar usuários):

```typescript
// supabase/functions/proxy-piperun/index.ts
// Recebe endpoint e params, faz a chamada ao PipeRun e retorna o resultado
// Usado APENAS para configuração, NÃO para dados do dashboard

serve(async (req) => {
  const { endpoint, params } = await req.json()
  
  // Whitelist de endpoints permitidos (segurança)
  const allowedEndpoints = ["/pipelines", "/stages", "/users", "/customFields", 
                            "/origins", "/lostReasons", "/activityTypes", "/"]
  
  if (!allowedEndpoints.some(e => endpoint.startsWith(e))) {
    return new Response(JSON.stringify({ error: "Endpoint não permitido" }), { status: 403 })
  }

  // Chamar PipeRun com o token server-side
  const url = new URL(`${PIPERUN_BASE}${endpoint}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v as string))

  const response = await fetch(url.toString(), {
    headers: { "Token": PIPERUN_TOKEN, "Accept": "application/json" }
  })

  const data = await response.json()
  return new Response(JSON.stringify(data))
})
```

### 10.6 Mapeamento de Campos Customizados

Os campos customizados no PipeRun vêm dentro de `customForms` quando se usa `with=customForms` no endpoint de deals. A estrutura típica é:

```json
{
  "id": 12345,
  "title": "Empresa ABC",
  "value": 30000,
  "status": "won",
  "customForms": [
    {
      "id": 1,
      "name": "Formulário Comercial",
      "fields": [
        {
          "id": 101,
          "key": "cf_valor_faturamento",
          "label": "Valor de Faturamento",
          "value": "90000.00",
          "type": "currency"
        },
        {
          "id": 102,
          "key": "cf_valor_entrada",
          "label": "Valor de Entrada",
          "value": "30000.00",
          "type": "currency"
        },
        {
          "id": 103,
          "key": "cf_plano",
          "label": "Plano Contratado",
          "value": "Aceleração",
          "type": "select"
        }
      ]
    }
  ]
}
```

> ⚠️ A estrutura exata dos customForms pode variar. O sistema deve ser resiliente:
> - Navegar pelo array de `customForms` → `fields`
> - Buscar o campo pelo `id` ou `key` mapeado na configuração
> - Tratar campos ausentes (null/undefined) sem quebrar
> - O mapeamento (qual field_id = "Valor de Faturamento") é salvo no `piperun_config.field_mappings`

**Função utilitária para extrair campos customizados:**
```typescript
// src/utils/piperunFields.ts
function extractCustomField(deal: CachedDeal, fieldMapping: string): string | null {
  const customForms = deal.custom_fields?.customForms || deal.custom_fields || []
  for (const form of customForms) {
    for (const field of form.fields || []) {
      if (String(field.id) === fieldMapping || field.key === fieldMapping) {
        return field.value
      }
    }
  }
  return null
}
```

### 10.7 Cálculos e Métricas (src/utils/metrics.ts)

Todas as funções operam sobre dados do cache Supabase (não chamam PipeRun):

```typescript
// ===== CLOSERS =====

// Taxa de conversão: deals ganhos / total de deals no período
calcConversionRate(deals: CachedDeal[]): number {
  const total = deals.length
  const won = deals.filter(d => d.status === "won").length
  return total > 0 ? (won / total) * 100 : 0
}

// Win rate: ganhos / (ganhos + perdidos) — exclui em aberto
calcWinRate(deals: CachedDeal[]): number {
  const won = deals.filter(d => d.status === "won").length
  const lost = deals.filter(d => d.status === "lost").length
  const decided = won + lost
  return decided > 0 ? (won / decided) * 100 : 0
}

// Ticket médio
calcAverageTicket(deals: CachedDeal[], fieldMapping: FieldMappings): number {
  const wonDeals = deals.filter(d => d.status === "won")
  const totalRevenue = wonDeals.reduce((sum, d) => {
    const val = extractCustomField(d, fieldMapping.revenue) || d.value
    return sum + (parseFloat(val) || 0)
  }, 0)
  return wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0
}

// MRR = receita total de faturamento / 12
calcMRR(deals: CachedDeal[], fieldMapping: FieldMappings): number {
  return calcTotalRevenue(deals, fieldMapping) / 12
}

// Ciclo de vendas: média de dias entre created_at e updated_at dos deals ganhos
calcSalesCycle(deals: CachedDeal[]): number {
  const wonDeals = deals.filter(d => d.status === "won")
  if (wonDeals.length === 0) return 0
  const totalDays = wonDeals.reduce((sum, d) => {
    const created = new Date(d.piperun_created_at)
    const closed = new Date(d.piperun_updated_at)
    return sum + differenceInDays(closed, created)
  }, 0)
  return totalDays / wonDeals.length
}

// Cobertura de pipeline
calcPipelineCoverage(deals: CachedDeal[], monthlyGoal: number): number {
  const openValue = deals
    .filter(d => d.status === "open")
    .reduce((sum, d) => sum + (d.value || 0), 0)
  return monthlyGoal > 0 ? openValue / monthlyGoal : 0
}

// ===== SDRs =====

// Taxa de contato: leads com atividades / total de leads
calcContactRate(deals: CachedDeal[], activities: CachedActivity[]): number {
  const dealIdsWithActivity = new Set(activities.map(a => a.deal_id))
  const contacted = deals.filter(d => dealIdsWithActivity.has(d.piperun_deal_id)).length
  return deals.length > 0 ? (contacted / deals.length) * 100 : 0
}

// Taxa de qualificação: leads na etapa de qualificação+ / total
calcQualificationRate(deals: CachedDeal[], qualificationStageId: number): number {
  // Precisamos do histórico de etapas ou verificar stage_id atual
  const qualified = deals.filter(d => d.stage_id >= qualificationStageId).length
  return deals.length > 0 ? (qualified / deals.length) * 100 : 0
}

// Show rate: atividades de reunião concluídas / agendadas
calcShowRate(activities: CachedActivity[], meetingTypeId: number): number {
  const meetings = activities.filter(a => a.activity_type_id === meetingTypeId)
  const completed = meetings.filter(a => a.status === "done" || a.status === "completed")
  return meetings.length > 0 ? (completed.length / meetings.length) * 100 : 0
}

// SLA de primeiro contato: horas entre criação do deal e primeira atividade
calcFirstContactSLA(deals: CachedDeal[], activities: CachedActivity[]): number {
  const slaHours: number[] = []
  for (const deal of deals) {
    const dealActivities = activities
      .filter(a => a.deal_id === deal.piperun_deal_id)
      .sort((a, b) => new Date(a.piperun_created_at).getTime() - new Date(b.piperun_created_at).getTime())
    if (dealActivities.length > 0) {
      const created = new Date(deal.piperun_created_at)
      const firstActivity = new Date(dealActivities[0].piperun_created_at)
      slaHours.push(differenceInHours(firstActivity, created))
    }
  }
  return slaHours.length > 0 ? slaHours.reduce((a, b) => a + b, 0) / slaHours.length : 0
}

// ===== FORECAST =====
calcForecastGap(goal: number, realized: number, workingDaysTotal: number, workingDaysElapsed: number): ForecastResult {
  const expectedByNow = (goal / workingDaysTotal) * workingDaysElapsed
  const gap = realized - expectedByNow
  const remaining = goal - realized
  const remainingDays = workingDaysTotal - workingDaysElapsed
  const dailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0
  return { expectedByNow, gap, remaining, remainingDays, dailyNeeded }
}
```

---

## 11. MODELO DE DADOS SUPABASE

### Tabelas a criar:

```sql
-- =============================================
-- PERFIS DE USUÁRIO
-- =============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('master', 'admin', 'closer', 'sdr')),
  avatar_url TEXT,
  piperun_user_id INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- METAS (flexível para suportar múltiplos tipos)
-- =============================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('annual', 'quarterly', 'monthly')),
  period_value INTEGER, -- mês (1-12) ou trimestre (1-4), NULL para anual
  goal_type TEXT NOT NULL CHECK (goal_type IN ('revenue', 'entry', 'meetings', 'leads')),
  target_value DECIMAL(15,2) NOT NULL,
  user_id UUID REFERENCES user_profiles(id), -- NULL = meta do time
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CONFIGURAÇÃO DA INTEGRAÇÃO PIPERUN
-- =============================================
CREATE TABLE piperun_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_token_encrypted TEXT NOT NULL, -- token criptografado, NÃO plain text
  base_url TEXT DEFAULT 'https://api.pipe.run/v1',
  account_name TEXT,                -- nome da conta retornado pela API
  token_user_email TEXT,            -- email do dono do token
  token_user_acl TEXT,              -- nível de acesso (G1, C1)
  closer_pipeline_id INTEGER,
  closer_pipeline_name TEXT,
  sdr_pipeline_id INTEGER,
  sdr_pipeline_name TEXT,
  stage_mappings JSONB DEFAULT '{}',  -- ex: {"qualification_stage_id": 123, "meeting_stage_id": 456}
  field_mappings JSONB DEFAULT '{}',  -- ex: {"revenue_field_id": "101", "entry_field_id": "102"}
  visible_fields JSONB DEFAULT '{}',
  dashboard_config JSONB DEFAULT '{}',
  sync_interval_minutes INTEGER DEFAULT 5,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'never', -- 'success', 'error', 'never', 'running'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CACHE DE DEALS DO PIPERUN
-- =============================================
CREATE TABLE piperun_deals_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piperun_deal_id INTEGER NOT NULL UNIQUE, -- ID no PipeRun
  pipeline_id INTEGER NOT NULL,
  stage_id INTEGER,
  user_id INTEGER,                    -- user_id do PipeRun (vincular com user_profiles.piperun_user_id)
  status TEXT CHECK (status IN ('open', 'won', 'lost')),
  value DECIMAL(15,2),                -- valor nativo do deal
  title TEXT,
  origin_id INTEGER,
  lost_reason_id INTEGER,
  person_id INTEGER,
  company_id INTEGER,
  custom_fields JSONB DEFAULT '{}',   -- customForms completo do PipeRun
  piperun_created_at TIMESTAMPTZ,
  piperun_updated_at TIMESTAMPTZ,
  raw_data JSONB,                     -- JSON completo do deal para debug
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deals_cache_pipeline ON piperun_deals_cache(pipeline_id);
CREATE INDEX idx_deals_cache_user ON piperun_deals_cache(user_id);
CREATE INDEX idx_deals_cache_status ON piperun_deals_cache(status);
CREATE INDEX idx_deals_cache_created ON piperun_deals_cache(piperun_created_at);
CREATE INDEX idx_deals_cache_updated ON piperun_deals_cache(piperun_updated_at);

-- =============================================
-- CACHE DE ATIVIDADES DO PIPERUN
-- =============================================
CREATE TABLE piperun_activities_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piperun_activity_id INTEGER NOT NULL UNIQUE,
  deal_id INTEGER,                    -- FK lógica para piperun_deals_cache.piperun_deal_id
  user_id INTEGER,
  activity_type_id INTEGER,
  status TEXT,                        -- done, pending, etc.
  title TEXT,
  piperun_created_at TIMESTAMPTZ,
  piperun_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_cache_deal ON piperun_activities_cache(deal_id);
CREATE INDEX idx_activities_cache_user ON piperun_activities_cache(user_id);
CREATE INDEX idx_activities_cache_type ON piperun_activities_cache(activity_type_id);

-- =============================================
-- LOG DE SINCRONIZAÇÃO
-- =============================================
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'error')),
  deals_synced INTEGER DEFAULT 0,
  activities_synced INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  error_message TEXT,
  duration_ms INTEGER
);

-- =============================================
-- SNAPSHOTS DO RANKING (para detectar mudanças de posição)
-- =============================================
CREATE TABLE ranking_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('closer', 'sdr')),
  metric TEXT NOT NULL,           -- 'revenue', 'entry', 'deals', 'meetings', etc.
  ranking_data JSONB NOT NULL     -- [{user_id, position, value, previous_position}]
);

-- Limpar snapshots com mais de 90 dias
CREATE OR REPLACE FUNCTION cleanup_old_snapshots() RETURNS void AS $$
  DELETE FROM ranking_snapshots WHERE snapshot_at < NOW() - INTERVAL '90 days';
$$ LANGUAGE sql;

-- =============================================
-- NOTIFICAÇÕES
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id), -- NULL = notificação para todos
  type TEXT NOT NULL CHECK (type IN ('goal_reached', 'ranking_change', 'gap_alert', 'high_value_deal', 'sync_error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',        -- dados contextuais (deal_id, position, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- =============================================
-- TABELAS DE REFERÊNCIA (cache de dados estáticos do PipeRun)
-- =============================================
CREATE TABLE piperun_stages_cache (
  piperun_stage_id INTEGER PRIMARY KEY,
  pipeline_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE piperun_origins_cache (
  piperun_origin_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE piperun_lost_reasons_cache (
  piperun_reason_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE piperun_activity_types_cache (
  piperun_type_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies:
```sql
-- user_profiles: usuário vê o próprio, master/admin veem todos
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('master', 'admin'))
  );

CREATE POLICY "Admins can update profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('master', 'admin'))
  );

-- goals: apenas master/admin editam, todos leem
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can read goals" ON goals FOR SELECT USING (true);

CREATE POLICY "Admins can manage goals" ON goals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('master', 'admin'))
  );

-- piperun_config: apenas master/admin leem e editam
ALTER TABLE piperun_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage piperun config" ON piperun_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('master', 'admin'))
  );

-- cache tables: todos leem (dados são públicos dentro da org), sistema escreve
ALTER TABLE piperun_deals_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read deals cache" ON piperun_deals_cache FOR SELECT USING (true);

ALTER TABLE piperun_activities_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read activities cache" ON piperun_activities_cache FOR SELECT USING (true);

-- ranking_snapshots: todos leem, sistema escreve
ALTER TABLE ranking_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All users can read ranking" ON ranking_snapshots FOR SELECT USING (true);

-- notifications: usuário vê as próprias + as globais (user_id IS NULL)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
```

### Realtime subscriptions (habilitar no Supabase):
```sql
-- Habilitar Realtime nas tabelas que o frontend precisa escutar
ALTER PUBLICATION supabase_realtime ADD TABLE piperun_deals_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE piperun_activities_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE ranking_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_log;
```

---

## 12. COMPONENTES PRINCIPAIS A CRIAR

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── BottomNav.tsx (mobile)
│   │   ├── SyncIndicator.tsx (status da sincronização)
│   │   └── PageLayout.tsx
│   ├── dashboard/
│   │   ├── KPICard.tsx (com barra de progresso e animação)
│   │   ├── ForecastCard.tsx (card de previsão vs realizado)
│   │   ├── DiagnosticAlert.tsx (alertas automáticos)
│   │   ├── SDRSection.tsx
│   │   └── CloserSection.tsx
│   ├── ranking/
│   │   ├── RankingPodium.tsx (top 3 com animação)
│   │   ├── RankingList.tsx (lista completa)
│   │   ├── RankingCard.tsx (card individual com animação de posição)
│   │   ├── RankingParticles.tsx (efeito de confetti)
│   │   └── LiveIndicator.tsx (badge "AO VIVO")
│   ├── charts/
│   │   ├── FunnelChart.tsx
│   │   ├── LineChart.tsx
│   │   ├── BarChart.tsx
│   │   ├── DonutChart.tsx
│   │   └── GoalProgressChart.tsx
│   ├── goals/
│   │   ├── GoalCard.tsx
│   │   ├── MonthlyGrid.tsx (grid de 12 meses editável)
│   │   └── TeamGoalTable.tsx
│   ├── settings/
│   │   ├── UserTable.tsx
│   │   ├── UserModal.tsx (create/edit)
│   │   ├── PiperunConfig.tsx
│   │   ├── PiperunStatus.tsx (card de status da conexão)
│   │   ├── StageMapper.tsx (mapear etapas do funil)
│   │   ├── FieldMapper.tsx (mapear campos customizados)
│   │   └── DashboardConfig.tsx
│   ├── setup/
│   │   └── SetupWizard.tsx (wizard de primeira configuração)
│   ├── notifications/
│   │   ├── NotificationBell.tsx
│   │   └── NotificationList.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Badge.tsx
│       ├── Avatar.tsx
│       ├── ProgressBar.tsx
│       ├── DateRangePicker.tsx (estilo Looker Studio)
│       ├── Skeleton.tsx
│       ├── EmptyState.tsx
│       └── ThemeToggle.tsx
├── pages/
│   ├── Login.tsx
│   ├── Setup.tsx
│   ├── Dashboard.tsx
│   ├── Ranking.tsx
│   ├── Goals.tsx
│   ├── Profile.tsx
│   └── settings/
│       ├── Settings.tsx
│       ├── Users.tsx
│       ├── GoalsConfig.tsx
│       ├── PiperunIntegration.tsx
│       └── DashboardConfig.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useRealtimeDeals.ts         -- Supabase Realtime subscription
│   ├── useRealtimeActivities.ts
│   ├── useRealtimeRanking.ts
│   ├── useRealtimeNotifications.ts
│   ├── useSyncStatus.ts            -- escuta sync_log para mostrar status
│   ├── useGoals.ts
│   ├── useRanking.ts
│   ├── usePiperunProxy.ts          -- chama Edge Function proxy-piperun
│   └── useDashboardConfig.ts
├── services/
│   ├── supabase.ts                 -- cliente Supabase
│   ├── piperunProxy.ts             -- wrapper para chamar Edge Functions
│   └── goals.ts
├── utils/
│   ├── metrics.ts                  -- todas as fórmulas de cálculo
│   ├── piperunFields.ts            -- extração de campos customizados
│   ├── formatters.ts               -- moeda BRL, %, datas
│   └── dateUtils.ts                -- dias úteis, períodos
├── types/
│   ├── piperun.ts                  -- tipos da API PipeRun
│   ├── cache.ts                    -- tipos das tabelas de cache
│   ├── supabase.ts
│   └── dashboard.ts
└── context/
    ├── AuthContext.tsx
    ├── ThemeContext.tsx
    ├── SyncContext.tsx              -- estado global da sincronização
    └── DashboardConfigContext.tsx
```

---

## 13. DESIGN SYSTEM

### 13.1 Tokens de Cor (Dark Mode - padrão)
```css
:root[data-theme="dark"] {
  --color-bg: #0d0d0d;
  --color-surface: #141414;
  --color-surface-2: #1a1a1a;
  --color-surface-3: #222222;
  --color-border: rgba(255,255,255,0.08);
  --color-text: #f0f0f0;
  --color-text-muted: #888888;
  --color-text-faint: #444444;

  /* Acentos */
  --color-gold: #f5c518;
  --color-gold-glow: rgba(245, 197, 24, 0.3);
  --color-success: #00c853;
  --color-warning: #ff9800;
  --color-danger: #f44336;
  --color-primary: #4f98a3;

  /* Ranking */
  --color-rank-1: #f5c518;  /* dourado */
  --color-rank-2: #c0c0c0;  /* prata */
  --color-rank-3: #cd7f32;  /* bronze */
  
  /* Sync status */
  --color-sync-ok: #00c853;
  --color-sync-running: #ff9800;
  --color-sync-error: #f44336;
}

:root[data-theme="light"] {
  --color-bg: #f7f6f2;
  --color-surface: #ffffff;
  --color-surface-2: #f9f8f5;
  --color-surface-3: #f0ede8;
  --color-border: rgba(0,0,0,0.08);
  --color-text: #1a1a1a;
  --color-text-muted: #666666;
  /* Manter acentos iguais */
}
```

### 13.2 Fontes
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
```
- **Corpo/UI:** Inter
- **Rankings e KPIs (números grandes):** Rajdhani (fonte esportiva/técnica)

### 13.3 Formatação de Valores
```typescript
formatCurrency(value: number): string        // R$ 127.000,00
formatCurrencyCompact(value: number): string  // R$ 127k ou R$ 1,2M
formatPercent(value: number): string          // 93,8%
getProgressColor(percent: number): string     // >= 90 → verde, 60-89 → amarelo, < 60 → vermelho
formatSyncTime(date: Date): string            // "há 2 min" ou "14:32:05"
```

---

## 14. SISTEMA DE NOTIFICAÇÕES

### 14.1 Eventos que geram notificações

| Evento | Tipo | Destinatário | Mensagem exemplo |
|---|---|---|---|
| Meta mensal atingida | goal_reached | Todos | "🎯 Meta de faturamento de Abril atingida!" |
| Closer atinge meta individual | goal_reached | Closer + Admins | "🏆 João atingiu 100% da meta!" |
| Ultrapassagem no ranking | ranking_change | Closer/SDR afetados | "📈 Maria ultrapassou João no ranking!" |
| Gap > 30% no mês | gap_alert | Admins | "⚠️ Gap de 35% na meta — atenção!" |
| Deal de alto valor ganho | high_value_deal | Admins | "💰 Deal de R$ 60k ganho por João!" |
| Erro de sincronização | sync_error | Admins | "🔴 Falha na sync com PipeRun" |

### 14.2 Geração de notificações
- Notificações são geradas pela Edge Function `sync-piperun` após cada sync
- A function compara dados novos com anteriores para detectar eventos
- Notificações são inseridas na tabela `notifications` do Supabase
- Frontend recebe via Realtime subscription e mostra no sino do header

---

## 15. REQUISITOS DE QUALIDADE

### Performance
- Lazy loading em todas as rotas (`React.lazy` + `Suspense`)
- Skeleton loaders em todos os cards enquanto carrega dados do Supabase
- Memoização de cálculos pesados com `useMemo`
- Virtualização de listas longas com `react-window` se necessário
- Debounce nos filtros de data (300ms)

### Responsividade
- Breakpoints: 375px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop)
- Todos os cards empilham em mobile
- Tabelas viram cards em mobile
- Gráficos respeitam largura do container (100% width)

### Acessibilidade
- Todos os botões com `aria-label`
- Navegação por teclado completa
- Contraste WCAG AA garantido
- Loading states com `aria-busy`

### Estados de UI
- **Loading:** Skeleton shimmer em todas as seções com dados
- **Empty:** Mensagem amigável + ação sugerida (ex: "Nenhum deal encontrado no período. Tente ajustar os filtros.")
- **Error:** Toast de erro + botão de retry + log no console
- **Offline:** Banner informativo "Sem conexão — dados podem estar desatualizados"
- **Sync Error:** Banner amarelo "Última sincronização falhou — dados podem estar defasados. [Tentar novamente]"
- **First Use:** Redirect para /setup se não há configuração do PipeRun

---

## 16. ORDEM DE DESENVOLVIMENTO RECOMENDADA

1. Setup do projeto (Vite + React + TS + Supabase + Router + Tailwind)
2. Design System (tokens CSS, componentes UI base)
3. Modelo de dados Supabase (todas as tabelas + RLS + Realtime)
4. Autenticação (login, proteção de rotas, validação de domínio)
5. Layout base (Sidebar, Header, PageLayout)
6. **Supabase Edge Functions (sync-piperun + proxy-piperun)** ← NOVO, essencial
7. Configurações — PipeRun (configuração + teste de conexão + mapeamento)
8. Wizard de Setup (fluxo de primeira configuração)
9. Hooks de Realtime (useRealtimeDeals, useRealtimeActivities)
10. Dashboard — Seção Visão Geral (KPI Cards + Forecast)
11. Dashboard — Seção SDR
12. Dashboard — Seção Closer
13. Tela de Ranking Gamificado (componentes + animações Framer Motion)
14. Tela de Metas (visualização)
15. Configurações — Metas (CRUD de metas)
16. Configurações — Usuários (CRUD completo)
17. Configurações — Dashboard (configuração de visões)
18. Sistema de Notificações (tabela + geração + sino)
19. Testes unitários em `metrics.ts` e `piperunFields.ts`
20. Responsividade, polimento visual, testes manuais
21. Build e deploy via FTP

---

## 17. OBSERVAÇÕES FINAIS

- O nome do projeto no `package.json` deve ser `dashboard-contador-ceo`
- O `index.html` deve ter `<title>Ranking de Vendas | Contador CEO</title>`
- Incluir `public/_redirects` com `/* /index.html 200`
- Incluir `public/.htaccess` para compatibilidade LiteSpeed/Apache
- **NUNCA** chamar a API do PipeRun diretamente do frontend — sempre via Edge Functions
- **NUNCA** expor tokens em variáveis `VITE_*` — usar Supabase Secrets
- URL correta da API: `https://api.pipe.run/v1` (NÃO `app.pipe.run`)
- Autenticação da API: Header `Token: <valor>` (NÃO Bearer)
- Paginação: usar `cursor` (NÃO `page`) — `page` está sendo descontinuado
- Rate limit: 120 requests / 30 segundos — implementar throttling com `Retry-After`
- Implementar `ErrorBoundary` global para capturar erros inesperados
- Console logs de desenvolvimento devem ser removidos no build de produção
- O Supabase Auth deve ser configurado para aceitar apenas `@absgroup.com.br`

---

## 18. RESUMO DAS CORREÇÕES vs VERSÃO ANTERIOR

| Item | Versão 1 (errado) | Versão 2 (correto) |
|---|---|---|
| URL da API | `https://app.pipe.run/v1` | `https://api.pipe.run/v1` |
| Autenticação | Bearer token | Header `Token: <valor>` |
| Paginação | `page` + `show` | `cursor` + `show` (max 200) |
| Token no frontend | `VITE_PIPERUN_API_TOKEN` | Supabase Secret (server-side) |
| Chamadas PipeRun | Frontend direto | Via Edge Functions |
| Atualização | Polling 60s direto na API | Sync incremental 2-5min + Realtime |
| Rate limit | Não mencionado | 120 req/30s com Retry-After |
| Endpoint de pessoas | `/people` | `/persons` |
| Cache | Em memória no frontend | Tabelas Supabase + Realtime |
| Seed admin | Não definido | Rota /setup ou seed SQL |
| Notificações | Mencionado sem definição | Tabela + eventos + geração |
| Campos custom | Não especificado | Via `customForms` + mapeamento |
| Sync incremental | Não existia | `updated_at_start` + cursor |
