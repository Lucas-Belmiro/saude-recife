import { NextRequest, NextResponse } from "next/server";

const RECIFE_CITY_CODE = "261160";
const CNES_ENDPOINT = "https://apidadosabertos.saude.gov.br/cnes/estabelecimentos";
const PAGE_SIZE = 20;
const MAX_RECORDS_WITH_BAIRRO = 4000;
const MAX_RECORDS_WITHOUT_BAIRRO = 200;
const FETCH_BATCH_SIZE = 8;

type CnesEstabelecimento = {
  codigo_cnes: number;
  nome_razao_social: string | null;
  nome_fantasia: string | null;
  codigo_tipo_unidade: number | null;
  endereco_estabelecimento: string | null;
  numero_estabelecimento: string | null;
  bairro_estabelecimento: string | null;
  codigo_cep_estabelecimento: string | null;
  numero_telefone_estabelecimento: string | null;
  latitude_estabelecimento_decimo_grau: number | null;
  longitude_estabelecimento_decimo_grau: number | null;
  endereco_email_estabelecimento: string | null;
  descricao_turno_atendimento: string | null;
  descricao_esfera_administrativa: string | null;
  estabelecimento_faz_atendimento_ambulatorial_sus: string | null;
  estabelecimento_possui_centro_cirurgico: number | null;
  estabelecimento_possui_centro_obstetrico: number | null;
  estabelecimento_possui_centro_neonatal: number | null;
  estabelecimento_possui_atendimento_hospitalar: number | null;
  estabelecimento_possui_servico_apoio: number | null;
  estabelecimento_possui_atendimento_ambulatorial: number | null;
  data_atualizacao: string | null;
};

type CnesResponse = {
  estabelecimentos?: CnesEstabelecimento[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesText(value: string | null, query: string) {
  return !query || normalize(value ?? "").includes(query);
}

function matchesBairro(value: string | null, bairro: string) {
  return !bairro || normalize(value ?? "") === bairro;
}

function matchesResource(estabelecimento: CnesEstabelecimento, resource: string) {
  if (!resource) {
    return true;
  }

  const resourceMap: Record<string, keyof CnesEstabelecimento> = {
    ambulatorial: "estabelecimento_possui_atendimento_ambulatorial",
    apoio: "estabelecimento_possui_servico_apoio",
    hospitalar: "estabelecimento_possui_atendimento_hospitalar",
    cirurgico: "estabelecimento_possui_centro_cirurgico",
    obstetrico: "estabelecimento_possui_centro_obstetrico",
  };

  const key = resourceMap[resource];
  return key ? estabelecimento[key] === 1 : true;
}

function filterEstabelecimentos(
  estabelecimentos: CnesEstabelecimento[],
  bairro: string,
  search: string,
  sus: string,
  resource: string,
) {
  return estabelecimentos.filter((estabelecimento) => {
    const hasBairro = matchesBairro(estabelecimento.bairro_estabelecimento, bairro);
    const hasSearch =
      !search ||
      matchesText(estabelecimento.nome_fantasia, search) ||
      matchesText(estabelecimento.nome_razao_social, search) ||
      matchesText(estabelecimento.endereco_estabelecimento, search);
    const hasSus =
      !sus || normalize(estabelecimento.estabelecimento_faz_atendimento_ambulatorial_sus ?? "") === sus;

    return hasBairro && hasSearch && hasSus && matchesResource(estabelecimento, resource);
  });
}

async function fetchPage(offset: number) {
  const url = new URL(CNES_ENDPOINT);
  url.searchParams.set("codigo_municipio", RECIFE_CITY_CODE);
  url.searchParams.set("status", "1");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new Error("CNES_REQUEST_FAILED");
  }

  const data = (await response.json()) as CnesResponse;
  return data.estabelecimentos ?? [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const bairro = normalize(searchParams.get("bairro") ?? "");
  const search = normalize(searchParams.get("q") ?? "");
  const sus = normalize(searchParams.get("sus") ?? "");
  const resource = normalize(searchParams.get("resource") ?? "");
  const maxRecords = bairro ? MAX_RECORDS_WITH_BAIRRO : MAX_RECORDS_WITHOUT_BAIRRO;
  const collected = new Map<number, CnesEstabelecimento>();
  let reachedLimit = true;

  try {
    for (let batchStart = 0; batchStart < maxRecords; batchStart += PAGE_SIZE * FETCH_BATCH_SIZE) {
      const offsets = Array.from({ length: FETCH_BATCH_SIZE }, (_, index) => batchStart + index * PAGE_SIZE).filter(
        (offset) => offset < maxRecords,
      );
      const pages = await Promise.all(offsets.map((offset) => fetchPage(offset)));

      pages.flat().forEach((estabelecimento) => {
        collected.set(estabelecimento.codigo_cnes, estabelecimento);
      });

      if (pages.some((page) => page.length < PAGE_SIZE)) {
        reachedLimit = false;
        break;
      }
    }

    const uniqueEstabelecimentos = Array.from(collected.values());
    const filtered = filterEstabelecimentos(uniqueEstabelecimentos, bairro, search, sus, resource).slice(0, 120);
    const bairrosByKey = new Map<string, string>();
    uniqueEstabelecimentos.forEach((item) => {
      const bairro = item.bairro_estabelecimento;

      if (bairro) {
        bairrosByKey.set(normalize(bairro), bairro);
      }
    });
    const bairros = Array.from(bairrosByKey.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return NextResponse.json({
      estabelecimentos: filtered,
      bairros,
      totalConsultado: uniqueEstabelecimentos.length,
      limiteAtingido: reachedLimit,
      municipio: RECIFE_CITY_CODE,
      fonte: CNES_ENDPOINT,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CNES_REQUEST_FAILED") {
      return NextResponse.json(
        { message: "Nao foi possivel consultar a base do CNES no momento." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { message: "Erro inesperado ao consultar os dados abertos de saude." },
      { status: 500 },
    );
  }
}
