"use client";

import { FormEvent, startTransition, useDeferredValue, useEffect, useState } from "react";

type HealthEstablishment = {
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

type ApiResponse = {
  estabelecimentos: HealthEstablishment[];
  bairros: string[];
  totalConsultado: number;
  limiteAtingido: boolean;
  fonte: string;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const resourceLabels = {
  ambulatorial: "Atendimento ambulatorial",
  apoio: "Servico de apoio",
  hospitalar: "Atendimento hospitalar",
  cirurgico: "Centro cirurgico",
  obstetrico: "Centro obstetrico",
};

const recifeNeighborhoods = [
  "Afogados",
  "Aflitos",
  "Agua Fria",
  "Alto Jose Bonifacio",
  "Alto Jose do Pinho",
  "Apipucos",
  "Areias",
  "Arruda",
  "Barro",
  "Beberibe",
  "Boa Viagem",
  "Boa Vista",
  "Bomba do Hemeterio",
  "Bongi",
  "Brasilia Teimosa",
  "Cabanga",
  "Cajueiro",
  "Campina do Barreto",
  "Campo Grande",
  "Casa Amarela",
  "Casa Forte",
  "Caxanga",
  "Cidade Universitaria",
  "Coelhos",
  "Cohab",
  "Coque",
  "Coqueiral",
  "Cordeiro",
  "Curado",
  "Derby",
  "Dois Irmaos",
  "Dois Unidos",
  "Encruzilhada",
  "Engenho do Meio",
  "Espinheiro",
  "Estancia",
  "Fundao",
  "Gracas",
  "Guabiraba",
  "Hipodromo",
  "Ibura",
  "Ilha Joana Bezerra",
  "Ilha do Leite",
  "Ilha do Retiro",
  "Imbiribeira",
  "Iputinga",
  "Jaqueira",
  "Jardim Sao Paulo",
  "Jiquia",
  "Jordao",
  "Linha do Tiro",
  "Macaxeira",
  "Madalena",
  "Mangabeira",
  "Mangueira",
  "Monteiro",
  "Morro da Conceicao",
  "Mustardinha",
  "Nova Descoberta",
  "Paissandu",
  "Parnamirim",
  "Passarinho",
  "Pina",
  "Poco da Panela",
  "Ponto de Parada",
  "Porto da Madeira",
  "Prado",
  "Recife",
  "Rosarinho",
  "San Martin",
  "Sancho",
  "Santana",
  "Santo Amaro",
  "Santo Antonio",
  "Sao Jose",
  "Sitio dos Pintos",
  "Soledade",
  "Tamarineira",
  "Tejipio",
  "Torre",
  "Torreao",
  "Torroes",
  "Toto",
  "Varzea",
  "Zumbi",
];
const featuredNeighborhoods = ["Boa Viagem", "Casa Amarela", "Afogados", "Iputinga", "Pina"];

function formatName(estabelecimento: HealthEstablishment) {
  return estabelecimento.nome_fantasia || estabelecimento.nome_razao_social || "Estabelecimento sem nome";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqueNeighborhoodOptions(neighborhoods: string[]) {
  const options = new Map<string, string>();

  neighborhoods.forEach((neighborhood) => {
    const key = normalizeText(neighborhood);

    if (!options.has(key)) {
      options.set(key, neighborhood);
    }
  });

  return Array.from(options.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function formatAddress(estabelecimento: HealthEstablishment) {
  const street = estabelecimento.endereco_estabelecimento;
  const number = estabelecimento.numero_estabelecimento;
  const bairro = estabelecimento.bairro_estabelecimento;
  const cep = estabelecimento.codigo_cep_estabelecimento;

  return [street && `${street}${number ? `, ${number}` : ""}`, bairro, cep && `CEP ${cep}`]
    .filter(Boolean)
    .join(" - ");
}

function normalizePhone(phone: string | null) {
  return phone?.replace(/\D/g, "") ?? "";
}

function getMapsUrl(estabelecimento: HealthEstablishment) {
  const lat = estabelecimento.latitude_estabelecimento_decimo_grau;
  const lng = estabelecimento.longitude_estabelecimento_decimo_grau;

  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(estabelecimento))}`;
}

function calculateDistance(estabelecimento: HealthEstablishment, coordinates: Coordinates | null) {
  const lat = estabelecimento.latitude_estabelecimento_decimo_grau;
  const lng = estabelecimento.longitude_estabelecimento_decimo_grau;

  if (!coordinates || lat === null || lng === null) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const distanceLat = toRadians(lat - coordinates.latitude);
  const distanceLng = toRadians(lng - coordinates.longitude);
  const startLat = toRadians(coordinates.latitude);
  const endLat = toRadians(lat);
  const haversine =
    Math.sin(distanceLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(distanceLng / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getServices(estabelecimento: HealthEstablishment) {
  return [
    estabelecimento.estabelecimento_faz_atendimento_ambulatorial_sus === "SIM" && "Atende SUS",
    estabelecimento.estabelecimento_possui_atendimento_ambulatorial === 1 && "Ambulatorial",
    estabelecimento.estabelecimento_possui_servico_apoio === 1 && "Apoio diagnostico",
    estabelecimento.estabelecimento_possui_atendimento_hospitalar === 1 && "Hospitalar",
    estabelecimento.estabelecimento_possui_centro_cirurgico === 1 && "Centro cirurgico",
    estabelecimento.estabelecimento_possui_centro_obstetrico === 1 && "Centro obstetrico",
    estabelecimento.estabelecimento_possui_centro_neonatal === 1 && "Centro neonatal",
  ].filter(Boolean) as string[];
}

export default function HealthFinder() {
  const [bairroInput, setBairroInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ bairro: "", q: "", sus: "", resource: "" });
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selected, setSelected] = useState<HealthEstablishment | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const deferredFilters = useDeferredValue(filters);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();

    Object.entries(deferredFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    setStatus("loading");
    setMessage("");
    setData(null);
    setSelected(null);

    fetch(`/api/estabelecimentos?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar os estabelecimentos.");
        }

        return (await response.json()) as ApiResponse;
      })
      .then((nextData) => {
        setData(nextData);
        setSelected(deferredFilters.bairro ? nextData.estabelecimentos[0] ?? null : null);
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") {
          return;
        }

        setStatus("error");
        setMessage(error.message);
      });

    return () => controller.abort();
  }, [deferredFilters]);

  const hasSelectedBairro = Boolean(filters.bairro);
  const bairroOptions = uniqueNeighborhoodOptions([...recifeNeighborhoods, ...(data?.bairros ?? [])]);
  const results = hasSelectedBairro ? data?.estabelecimentos ?? [] : [];
  const sortedResults = coordinates
    ? [...results].sort((first, second) => {
        const firstDistance = calculateDistance(first, coordinates) ?? Number.POSITIVE_INFINITY;
        const secondDistance = calculateDistance(second, coordinates) ?? Number.POSITIVE_INFINITY;
        return firstDistance - secondDistance;
      })
    : results;
  const services = selected ? getServices(selected) : [];

  function clearSearchResults() {
    setData(null);
    setSelected(null);
    setMessage("");
  }

  function applyOptionalFilter(filter: Partial<typeof filters>) {
    clearSearchResults();
    startTransition(() => {
      setFilters((current) => ({ ...current, bairro: current.bairro || bairroInput, ...filter }));
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearSearchResults();
    startTransition(() => {
      setFilters((current) => ({ ...current, bairro: bairroInput, q: searchInput }));
    });
  }

  function handleLocation() {
    if (!navigator.geolocation) {
      setMessage("Seu navegador nao informou suporte a localizacao.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setMessage("Resultados ordenados pela sua distancia aproximada.");
      },
      () => setMessage("Nao foi possivel acessar sua localizacao agora."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function handleShare(estabelecimento: HealthEstablishment) {
    const text = `${formatName(estabelecimento)} - ${formatAddress(estabelecimento)}`;

    if (navigator.share) {
      await navigator.share({ title: formatName(estabelecimento), text, url: getMapsUrl(estabelecimento) });
      return;
    }

    await navigator.clipboard.writeText(`${text}\n${getMapsUrl(estabelecimento)}`);
    setMessage("Informacoes copiadas para compartilhar.");
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--line)] bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[var(--ink)] text-sm font-bold text-white">SR</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Informacao em saude</p>
              <p className="font-semibold">Recife</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--muted)] sm:flex">
            <a href="#busca">Inicio</a>
            <a href="#resultados">Resultados</a>
            <a href="#detalhes">Detalhes</a>
          </nav>
        </div>
      </header>

      <section id="busca" className="border-b border-[var(--line)] bg-[linear-gradient(135deg,#f4fbf7_0%,#fff7ed_52%,#eef6ff_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_420px] lg:py-14">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-md border border-[var(--green-line)] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--green)]">
              Codigo municipal 261160
            </p>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-normal text-[var(--ink)] sm:text-5xl">
              Encontre estabelecimentos de saude por bairro no Recife
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              Consulte unidades cadastradas no CNES, veja endereco, contato, coordenadas e servicos disponiveis.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-4 rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Buscar por bairro
                <select
                  value={bairroInput}
                  onChange={(event) => {
                    setBairroInput(event.target.value);
                    clearSearchResults();
                    startTransition(() => setFilters((current) => ({ ...current, bairro: "" })));
                  }}
                  className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal outline-none transition focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green-soft)]"
                >
                  <option value="">Selecione um bairro</option>
                  {bairroOptions.map((bairro) => (
                    <option key={bairro} value={bairro}>
                      {bairro}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
                Nome ou endereco
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Ex.: UPA, clinica, rua"
                  className="h-11 rounded-md border border-[var(--line)] px-3 text-sm font-normal outline-none transition focus:border-[var(--green)] focus:ring-2 focus:ring-[var(--green-soft)]"
                />
              </label>
              <button className="h-11 self-end rounded-md bg-[var(--green)] px-5 text-sm font-bold text-white transition hover:bg-[var(--green-dark)]">
                Buscar
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {featuredNeighborhoods.map((bairro) => (
                <button
                  key={bairro}
                  onClick={() => {
                    setBairroInput(bairro);
                    clearSearchResults();
                    startTransition(() => setFilters((current) => ({ ...current, bairro })));
                  }}
                  className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--green)] hover:text-[var(--green)]"
                >
                  {bairro}
                </button>
              ))}
            </div>
          </div>

          <aside className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--ink)]">Filtros opcionais</h2>
            <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
              Atendimento SUS
              <select
                value={filters.sus}
                onChange={(event) => {
                  applyOptionalFilter({ sus: event.target.value });
                }}
                className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--green)]"
              >
                <option value="">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Nao</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
              Servico disponivel
              <select
                value={filters.resource}
                onChange={(event) => {
                  applyOptionalFilter({ resource: event.target.value });
                }}
                className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal outline-none focus:border-[var(--green)]"
              >
                <option value="">Qualquer servico</option>
                {Object.entries(resourceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleLocation}
              className="mt-2 h-11 rounded-md border border-[var(--green-line)] bg-[var(--green-soft)] px-4 text-sm font-bold text-[var(--green-dark)] transition hover:bg-white"
            >
              Usar minha localizacao
            </button>
            <p className="rounded-md bg-[var(--paper)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">
              Dados publicos do CNES. A busca por bairro e feita no app a partir do campo retornado pela API.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_430px]" id="resultados">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--green)]">Resultados para: {filters.bairro || "selecione um bairro"}</p>
              <h2 className="text-2xl font-bold text-[var(--ink)]">
                {status === "loading" && hasSelectedBairro
                  ? "Buscando unidades..."
                  : hasSelectedBairro
                    ? `${sortedResults.length} estabelecimento(s) encontrado(s)`
                    : "Escolha um bairro para ver os estabelecimentos"}
              </h2>
            </div>
            {hasSelectedBairro && data?.limiteAtingido && (
              <p className="max-w-md rounded-md border border-[var(--amber-line)] bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--amber)]">
                A API nao oferece filtro direto por bairro; alguns resultados podem depender do limite de consulta.
              </p>
            )}
          </div>

          {(message || status === "error") && (
            <p className="mb-4 rounded-md border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
              {message || "Nao foi possivel concluir a operacao."}
            </p>
          )}

          <div className="grid gap-3">
            {sortedResults.map((estabelecimento) => {
              const distance = calculateDistance(estabelecimento, coordinates);
              const isSelected = selected?.codigo_cnes === estabelecimento.codigo_cnes;

              return (
                <button
                  key={estabelecimento.codigo_cnes}
                  onClick={() => setSelected(estabelecimento)}
                  className={`grid gap-3 rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-[var(--green)] ${
                    isSelected ? "border-[var(--green)] ring-2 ring-[var(--green-soft)]" : "border-[var(--line)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--ink)]">{formatName(estabelecimento)}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">CNES {estabelecimento.codigo_cnes} - Tipo {estabelecimento.codigo_tipo_unidade ?? "nao informado"}</p>
                    </div>
                    {distance !== null && <span className="rounded-md bg-[var(--blue-soft)] px-2 py-1 text-xs font-bold text-[var(--blue)]">{distance.toFixed(1)} km</span>}
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{formatAddress(estabelecimento) || "Endereco nao informado"}</p>
                  <div className="flex flex-wrap gap-2">
                    {getServices(estabelecimento)
                      .slice(0, 4)
                      .map((service) => (
                        <span key={service} className="rounded-md bg-[var(--paper)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                          {service}
                        </span>
                      ))}
                  </div>
                </button>
              );
            })}
          </div>

          {!hasSelectedBairro && (
            <div className="rounded-lg border border-[var(--line)] bg-white p-8 text-center shadow-sm">
              <h3 className="text-xl font-bold text-[var(--ink)]">Nenhum bairro selecionado</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">Selecione um bairro acima para carregar os estabelecimentos correspondentes.</p>
            </div>
          )}

          {hasSelectedBairro && status !== "loading" && sortedResults.length === 0 && (
            <div className="rounded-lg border border-[var(--line)] bg-white p-8 text-center shadow-sm">
              <h3 className="text-xl font-bold text-[var(--ink)]">Nenhuma unidade encontrada</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">Altere o bairro, remova filtros ou tente outro termo de busca.</p>
            </div>
          )}
        </div>

        <aside id="detalhes" className="lg:sticky lg:top-5 lg:self-start">
          {selected ? (
            <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm">
              <div className="h-48 bg-[linear-gradient(135deg,#d9ece3,#f8dfbe)] p-4">
                <div className="grid h-full place-items-center rounded-md border border-white/80 bg-white/35">
                  <div className="grid size-16 place-items-center rounded-full bg-[var(--ink)] text-xl font-bold text-white">{formatName(selected).slice(0, 2)}</div>
                </div>
              </div>
              <div className="grid gap-5 p-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--green)]">{selected.bairro_estabelecimento ?? "Bairro nao informado"}</p>
                  <h2 className="mt-1 text-2xl font-bold text-[var(--ink)]">{formatName(selected)}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{formatAddress(selected) || "Endereco nao informado"}</p>
                </div>

                <dl className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4 rounded-md bg-[var(--paper)] px-3 py-2">
                    <dt className="font-semibold text-[var(--ink)]">Telefone</dt>
                    <dd className="text-right text-[var(--muted)]">{selected.numero_telefone_estabelecimento || "Nao informado"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-md bg-[var(--paper)] px-3 py-2">
                    <dt className="font-semibold text-[var(--ink)]">Turno</dt>
                    <dd className="text-right text-[var(--muted)]">{selected.descricao_turno_atendimento || "Nao informado"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-md bg-[var(--paper)] px-3 py-2">
                    <dt className="font-semibold text-[var(--ink)]">Atende SUS</dt>
                    <dd className="text-right text-[var(--muted)]">{selected.estabelecimento_faz_atendimento_ambulatorial_sus || "Nao informado"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 rounded-md bg-[var(--paper)] px-3 py-2">
                    <dt className="font-semibold text-[var(--ink)]">Atualizacao</dt>
                    <dd className="text-right text-[var(--muted)]">{selected.data_atualizacao || "Nao informada"}</dd>
                  </div>
                </dl>

                <div>
                  <h3 className="mb-2 text-sm font-bold text-[var(--ink)]">Servicos disponiveis</h3>
                  <div className="flex flex-wrap gap-2">
                    {(services.length ? services : ["Servicos nao informados"]).map((service) => (
                      <span key={service} className="rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={normalizePhone(selected.numero_telefone_estabelecimento) ? `tel:${normalizePhone(selected.numero_telefone_estabelecimento)}` : undefined}
                    className="rounded-md border border-[var(--line)] px-3 py-3 text-center text-sm font-bold text-[var(--ink)] transition hover:border-[var(--green)] hover:text-[var(--green)]"
                  >
                    Ligar
                  </a>
                  <a
                    href={getMapsUrl(selected)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-[var(--line)] px-3 py-3 text-center text-sm font-bold text-[var(--ink)] transition hover:border-[var(--green)] hover:text-[var(--green)]"
                  >
                    Rotas
                  </a>
                  <button
                    onClick={() => void handleShare(selected)}
                    className="rounded-md border border-[var(--line)] px-3 py-3 text-center text-sm font-bold text-[var(--ink)] transition hover:border-[var(--green)] hover:text-[var(--green)]"
                  >
                    Compartilhar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)] shadow-sm">
              Selecione um estabelecimento para ver detalhes, contato e rota.
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
