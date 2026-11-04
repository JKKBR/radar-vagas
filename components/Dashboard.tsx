"use client";

import { useEffect, useState } from "react";

type Data = {
  settings: any;
  sources: any[];
  jobs: any[];
};

const split = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("jobs");
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    include: "",
    exclude: "",
    cities: "",
    minScore: 60
  });

  const [source, setSource] = useState({
    name: "",
    url: ""
  });

  async function load() {
    const response = await fetch("/api/data");

    if (response.status === 401) {
      location.href = "/login";
      return;
    }

    const result = await response.json();

    setData(result);

    setForm({
      include: (result.settings?.include_keywords || []).join("\n"),
      exclude: (result.settings?.exclude_keywords || []).join("\n"),
      cities: (result.settings?.cities || []).join("\n"),
      minScore: result.settings?.min_score || 60
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setMsg("Salvando filtros...");

    const response = await fetch("/api/data", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        include: split(form.include),
        exclude: split(form.exclude),
        cities: split(form.cities),
        minScore: form.minScore
      })
    });

    setMsg(
      response.ok
        ? "Filtros salvos."
        : "Erro ao salvar os filtros."
    );

    await load();
  }

  async function run() {
    setMsg("Buscando vagas...");

    const response = await fetch("/api/run", {
      method: "POST"
    });

    const result = await response.json();

    if (response.ok) {
      const errors = result.errors?.length
        ? ` Erros: ${result.errors.join(" | ")}`
        : "";

      setMsg(
        `Busca concluída: ${result.found} nova(s), ` +
        `${result.sent} enviada(s).${errors}`
      );
    } else {
      setMsg(`Erro: ${result.error}`);
    }

    await load();
  }

  async function addSource(event: React.FormEvent) {
    event.preventDefault();

    const response = await fetch("/api/sources", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ...source,
        enabled: true
      })
    });

    setMsg(
      response.ok
        ? "Fonte adicionada."
        : "Não foi possível adicionar a fonte."
    );

    setSource({
      name: "",
      url: ""
    });

    await load();
  }

  async function patchSource(
    id: number,
    enabled: boolean
  ) {
    await fetch("/api/sources", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        id,
        enabled
      })
    });

    await load();
  }

  async function clearJobs() {
    const confirmed = window.confirm(
      "Deseja apagar todas as vagas encontradas?\n\n" +
      "Os filtros, as cidades e as fontes serão mantidos.\n\n" +
      "Esta ação não pode ser desfeita."
    );

    if (!confirmed) {
      return;
    }

    setMsg("Apagando buscas...");

    try {
      const response = await fetch("/api/jobs", {
        method: "DELETE"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Não foi possível apagar as buscas."
        );
      }

      setMsg(
        "Buscas apagadas. Clique em “Buscar agora” " +
        "para reavaliar as vagas."
      );

      await load();
    } catch (error) {
      setMsg(
        error instanceof Error
          ? `Erro: ${error.message}`
          : "Erro ao apagar as buscas."
      );
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST"
    });

    location.href = "/login";
  }

  if (!data) {
    return (
      <main className="p-8">
        Carregando...
      </main>
    );
  }

  const approved = data.jobs.filter(
    (job) => job.status === "approved"
  ).length;

  const ignored = data.jobs.length - approved;

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-slate-950/90 px-5 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-emerald-400">
              Radar de Vagas
            </h1>

            <p className="text-xs text-slate-400">
              Painel administrativo
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn bg-white/10"
              onClick={run}
            >
              Buscar agora
            </button>

            <button
              className="btn border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              onClick={clearJobs}
            >
              Apagar buscas
            </button>

            <button
              className="btn btn-primary"
              onClick={logout}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-5">
        <nav className="mb-5 flex flex-wrap gap-2">
          {[
            ["jobs", "Vagas"],
            ["filters", "Filtros"],
            ["sources", "Fontes"],
            ["telegram", "Telegram"]
          ].map(([id, name]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                `btn ${
                  tab === id
                    ? "btn-primary"
                    : "bg-white/10"
                }`
              }
            >
              {name}
            </button>
          ))}
        </nav>

        {msg && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            {msg}
          </div>
        )}

        {tab === "jobs" && (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <Stat
                n={data.jobs.length}
                t="Vagas encontradas"
              />

              <Stat
                n={approved}
                t="Compatíveis"
              />

              <Stat
                n={ignored}
                t="Fora do filtro"
              />
            </div>

            <section className="card overflow-hidden">
              {data.jobs.length === 0 ? (
                <p className="p-5 text-slate-400">
                  Nenhuma vaga armazenada. Clique em
                  “Buscar agora”.
                </p>
              ) : (
                data.jobs.map((job) => (
                  <article
                    key={job.id}
                    className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <a
                        className="font-semibold hover:text-emerald-400"
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {job.title}
                      </a>

                      <p className="mt-1 text-sm text-slate-400">
                        Nota {job.score}/100 ·{" "}
                        {job.status === "approved"
                          ? "Compatível"
                          : "Fora do filtro"}
                      </p>
                    </div>

                    <span
                      className={
                        `w-fit rounded-full px-3 py-1 text-xs ${
                          job.notified_at
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-700"
                        }`
                      }
                    >
                      {job.notified_at
                        ? "Enviada ao Telegram"
                        : "Não enviada"}
                    </span>
                  </article>
                ))
              )}
            </section>
          </>
        )}

        {tab === "filters" && (
          <section className="card grid gap-5 p-5 sm:grid-cols-2">
            <Area
              label="Palavras desejadas"
              value={form.include}
              onChange={(value) =>
                setForm({
                  ...form,
                  include: value
                })
              }
            />

            <Area
              label="Palavras bloqueadas"
              value={form.exclude}
              onChange={(value) =>
                setForm({
                  ...form,
                  exclude: value
                })
              }
            />

            <Area
              label="Cidades/localidades"
              value={form.cities}
              onChange={(value) =>
                setForm({
                  ...form,
                  cities: value
                })
              }
            />

            <label>
              Pontuação mínima:{" "}
              <b>{form.minScore}</b>

              <input
                className="mt-4 w-full accent-emerald-400"
                type="range"
                min="0"
                max="100"
                value={form.minScore}
                onChange={(event) =>
                  setForm({
                    ...form,
                    minScore: Number(event.target.value)
                  })
                }
              />
            </label>

            <button
              onClick={save}
              className="btn btn-primary sm:col-span-2"
            >
              Salvar filtros
            </button>
          </section>
        )}

        {tab === "sources" && (
          <>
            <form
              onSubmit={addSource}
              className="card mb-5 grid gap-3 p-5 sm:grid-cols-[1fr_2fr_auto]"
            >
              <input
                className="field"
                placeholder="Nome da fonte"
                value={source.name}
                onChange={(event) =>
                  setSource({
                    ...source,
                    name: event.target.value
                  })
                }
              />

              <input
                className="field"
                type="url"
                placeholder="URL do RSS/Atom público"
                value={source.url}
                onChange={(event) =>
                  setSource({
                    ...source,
                    url: event.target.value
                  })
                }
              />

              <button className="btn btn-primary">
                Adicionar
              </button>
            </form>

            <section className="card">
              {data.sources.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-white/10 p-4"
                >
                  <div>
                    <b>{item.name}</b>

                    <p className="max-w-xl truncate text-sm text-slate-400">
                      {item.url}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      patchSource(
                        item.id,
                        !item.enabled
                      )
                    }
                    className={
                      `btn ${
                        item.enabled
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-700"
                      }`
                    }
                  >
                    {item.enabled
                      ? "Ativa"
                      : "Desativada"}
                  </button>
                </div>
              ))}
            </section>

            <p className="mt-4 text-sm text-amber-300">
              Use somente RSS/Atom público ou um feed/API
              que você esteja autorizado a consultar.
            </p>
          </>
        )}

        {tab === "telegram" && (
          <section className="card max-w-xl p-5">
            <h2 className="text-xl font-bold">
              Telegram
            </h2>

            <p className="my-3 text-slate-400">
              Configure TELEGRAM_BOT_TOKEN e
              TELEGRAM_CHAT_ID nas variáveis de ambiente
              da Vercel.
            </p>

            <button
              className="btn btn-primary"
              onClick={async () => {
                const response = await fetch(
                  "/api/telegram-test",
                  {
                    method: "POST"
                  }
                );

                setMsg(
                  response.ok
                    ? "Mensagem de teste enviada."
                    : "Falha no teste."
                );
              }}
            >
              Enviar teste
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({
  n,
  t
}: {
  n: number;
  t: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-400">
        {t}
      </p>

      <p className="text-3xl font-bold">
        {n}
      </p>
    </div>
  );
}

function Area({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}

      <textarea
        className="field mt-2 min-h-36"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder="Uma por linha ou separadas por vírgula"
      />
    </label>
  );
}
