# Saude Recife

Aplicacao web em Next.js e TypeScript para consultar estabelecimentos de saude do Recife por bairro. O projeto usa dados publicos do Cadastro Nacional de Estabelecimentos de Saude (CNES), disponibilizados pela API de Dados Abertos do Ministerio da Saude.

## Objetivo

A aplicacao ajuda moradores do Recife a encontrar unidades e servicos de saude proximos ao bairro selecionado. A interface permite buscar por bairro, filtrar por atendimento SUS, filtrar por tipo de servico disponivel e visualizar detalhes como endereco, telefone, turno de atendimento, CNES e rotas no mapa.

## Fonte dos dados

Os dados sao consultados na API publica:

```text
https://apidadosabertos.saude.gov.br/cnes/estabelecimentos
```

O municipio de Recife e filtrado pelo codigo IBGE:

```text
261160
```

A API retorna os resultados paginados com `limit=20` e `offset` como deslocamento de registros. A rota interna da aplicacao faz a paginacao, remove duplicidades por `codigo_cnes` e unifica bairros equivalentes por normalizacao de texto.

## Funcionalidades

- Selecao de bairro sem digitacao livre.
- Busca por nome do estabelecimento ou endereco.
- Filtro por atendimento ambulatorial SUS.
- Filtro por servicos disponiveis, como apoio diagnostico, atendimento hospitalar e centro cirurgico.
- Listagem de estabelecimentos sem duplicidade de CNES.
- Painel de detalhes da unidade selecionada.
- Acoes para ligar, abrir rotas e compartilhar informacoes.
- Ordenacao aproximada por distancia quando o usuario permite acesso a localizacao.

## Tecnologias

- Next.js
- TypeScript
- React
- Tailwind CSS
- API Routes do Next.js

## Como executar

Instale as dependencias:

```bash
npm install
```

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse no navegador:

```text
http://localhost:3000
```

## Scripts disponiveis

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Observacoes

A API do CNES nao oferece filtro direto por bairro. Por isso, a aplicacao consulta os estabelecimentos ativos do municipio de Recife e aplica o filtro por bairro localmente, usando o campo `bairro_estabelecimento` retornado pela API.
