import { XMLParser } from "fast-xml-parser";
import { db } from "./supabase";
import { evaluate, Rules } from "./filter";
import { telegramJob } from "./telegram";

type Item = {
  title: string;
  link: string;
  description: string;
  publishedAt?: string;
};

type JobTitleDetails = {
  position: string;
  company?: string;
  salary?: string;
  location?: string;
  vacancies?: string;
  experience?: string;
  extras: string[];
};

const arr = <T,>(
  value: T | T[] | undefined
): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value)
    ? value
    : [value];
};

const clean = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "#text" in value
  ) {
    return String(
      (value as Record<string, unknown>)["#text"]
    );
  }

  return "";
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function decodeTitleEntities(title: string) {
  return title
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "–")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSalary(value: string) {
  const normalized = normalizeText(value);

  return (
    normalized.includes("r$") ||
    normalized.includes("salario") ||
    normalized.includes("pretensao salarial") ||
    normalized.includes("a combinar")
  );
}

function isVacancies(value: string) {
  return /\b\d+\s+vagas?\b/i.test(value);
}

function isExperience(value: string) {
  const normalized = normalizeText(value);

  return (
    normalized.includes("sem experiencia") ||
    normalized.includes("com experiencia") ||
    normalized.includes("experiencia desejavel") ||
    normalized.includes("experiencia necessaria") ||
    normalized.includes("experiencia obrigatoria") ||
    normalized.includes("experiencia")
  );
}

function isWorkModel(value: string) {
  const normalized = normalizeText(value);

  return (
    normalized.includes("home office") ||
    normalized.includes("remoto") ||
    normalized.includes("hibrido") ||
    normalized.includes("presencial")
  );
}

function isLocation(value: string) {
  const normalized = normalizeText(value);

  const locations = [
    "marica",
    "niteroi",
    "sao goncalo",
    "rio de janeiro",
    "penha",
    "centro",
    "copacabana",
    "barra da tijuca",
    "jacarepagua",
    "duque de caxias",
    "nova iguacu",
    "sao cristovao",
    "recreio",
    "recreio dos bandeirantes",
    "tijuca",
    "barra",
    "botafogo",
    "campo grande",
    "bangu",
    "madureira",
    "ilha do governador",
    "barra mansa",
    "volta redonda",
    "teresopolis",
    "petropolis",
    "cabo frio",
    "macae",
    "itaborai",
    "alcantara",
    "icarai",
    "santa rosa",
    "saquarema",
    "araruama",
    "resende",
    "nilopolis",
    "mesquita",
    "queimados",
    "sao joao de meriti",
    "belford roxo",
    "vila isabel",
    "leblon",
    "ipanema",
    "flamengo",
    "catete",
    "laranjeiras",
    "meier",
    "del castilho",
    "pavuna",
    "realengo",
    "taquara",
    "tanque",
    "curicica",
    "freguesia",
    "gardênia azul",
    "gávea",
    "gavea"
  ];

  return locations.some((location) =>
    normalized.includes(location)
  );
}

function parseJobTitle(
  title: string
): JobTitleDetails {
  const decoded = decodeTitleEntities(title);

  const parts = decoded
    .split(/\s+(?:–|—|\||•)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const details: JobTitleDetails = {
    position: parts[0] || "Vaga sem título",
    extras: []
  };

  for (const part of parts.slice(1)) {
    if (!details.salary && isSalary(part)) {
      details.salary = part;
      continue;
    }

    if (
      !details.vacancies &&
      isVacancies(part)
    ) {
      details.vacancies = part;
      continue;
    }

    if (
      !details.experience &&
      isExperience(part)
    ) {
      details.experience = part;
      continue;
    }

    if (
      !details.location &&
      isLocation(part)
    ) {
      details.location = part;
      continue;
    }

    if (
      !details.location &&
      isWorkModel(part)
    ) {
      details.location = part;
      continue;
    }

    if (!details.company) {
      details.company = part;
      continue;
    }

    details.extras.push(part);
  }

  return details;
}

async function readFeed(
  url: string
): Promise<Item[]> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "RadarVagas/1.0 (+painel pessoal)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `${url}: HTTP ${response.status}`
    );
  }

  const xml = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: true
  });

  const result = parser.parse(xml);

  if (result.rss?.channel?.item) {
    return arr(result.rss.channel.item).map(
      (item: any) => ({
        title: clean(item.title),
        link: clean(item.link),
        description: clean(
          item.description ||
          item["content:encoded"]
        ),
        publishedAt: clean(item.pubDate)
      })
    );
  }

  return arr(result.feed?.entry).map(
    (item: any) => ({
      title: clean(item.title),

      link:
        typeof item.link === "string"
          ? item.link
          : item.link?.["@_href"] ||
            arr(item.link)[0]?.["@_href"] ||
            "",

      description: clean(
        item.summary || item.content
      ),

      publishedAt: clean(
        item.updated || item.published
      )
    })
  );
}

export async function collect() {
  const database = db();

  const [
    { data: sources, error: sourcesError },
    { data: settings, error: settingsError }
  ] = await Promise.all([
    database
      .from("sources")
      .select("*")
      .eq("enabled", true),

    database
      .from("settings")
      .select("*")
      .single()
  ]);

  if (sourcesError) {
    throw new Error(
      `Erro ao carregar fontes: ${sourcesError.message}`
    );
  }

  if (settingsError) {
    throw new Error(
      `Erro ao carregar configurações: ${settingsError.message}`
    );
  }

  if (!settings) {
    throw new Error(
      "Configurações ausentes"
    );
  }

  const rules: Rules = {
    include:
      settings.include_keywords || [],

    exclude:
      settings.exclude_keywords || [],

    cities:
      settings.cities || [],

    minScore:
      settings.min_score ?? 60
  };

  let found = 0;
  let sent = 0;
  let approved = 0;
  let ignored = 0;
  let duplicates = 0;

  const errors: string[] = [];

  for (const source of sources || []) {
    try {
      if (source.kind !== "rss") {
        continue;
      }

      const items = await readFeed(
        source.url
      );

      for (const item of items) {
        if (!item.link || !item.title) {
          continue;
        }

        const evaluation = evaluate(
          `${item.title} ${item.description}`,
          rules
        );

        const {
          data: insertedJob,
          error: insertError
        } = await database
          .from("jobs")
          .upsert(
            {
              source_id: source.id,
              external_id: item.link,
              title: item.title,
              url: item.link,
              description: item.description,
              published_at:
                item.publishedAt || null,
              score: evaluation.score,
              status:
                evaluation.approved
                  ? "approved"
                  : "ignored",
              reasons: evaluation.reasons
            },
            {
              onConflict: "external_id",
              ignoreDuplicates: true
            }
          )
          .select("id")
          .maybeSingle();

        if (insertError) {
          throw insertError;
        }

        if (!insertedJob) {
          duplicates++;
          continue;
        }

        found++;

        if (!evaluation.approved) {
          ignored++;
          continue;
        }

        approved++;

        const details = parseJobTitle(
          item.title
        );

        await telegramJob({
          position: details.position,
          company: details.company,
          salary: details.salary,
          location: details.location,
          vacancies: details.vacancies,
          experience: details.experience,
          extras: details.extras,
          url: item.link,
          source: source.name,
          score: evaluation.score
        });

        const { error: notificationError } =
          await database
            .from("jobs")
            .update({
              notified_at:
                new Date().toISOString()
            })
            .eq("id", insertedJob.id);

        if (notificationError) {
          throw notificationError;
        }

        sent++;
      }
    } catch (error) {
      errors.push(
        `${source.name}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  return {
    found,
    approved,
    ignored,
    duplicates,
    sent,
    errors
  };
}
