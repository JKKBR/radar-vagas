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

const clean = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value &&
    "#text" in value
  ) {
    return String(
      (value as Record<string, unknown>)["#text"]
    );
  }

  return "";
};

function decodeTitleEntities(title: string) {
  return title
    .replace(/&ndash;/gi, "–")
    .replace(/&#8211;/gi, "–")
    .replace(/&#x2013;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&#8212;/gi, "—")
    .replace(/&#x2014;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'");
}

function cleanJobTitle(title: string) {
  const decodedTitle = decodeTitleEntities(title);

  const withoutHtml = decodedTitle.replace(
    /<[^>]*>/g,
    " "
  );

  const firstPart = withoutHtml.split(
    /\s+(?:–|—|\||•)\s+/
  )[0];

  return firstPart
    .replace(/\s+/g, " ")
    .trim();
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
            arr(item.link)[0]?.["@_href"],
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
    { data: sources },
    { data: settings }
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
      settings.min_score || 60
  };

  let found = 0;
  let sent = 0;

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

        const result = evaluate(
          `${item.title} ${item.description}`,
          rules
        );

        const {
          data,
          error
        } = await database
          .from("jobs")
          .upsert(
            {
              source_id: source.id,
              external_id: item.link,
              title: item.title,
              url: item.link,
              description:
                item.description,
              published_at:
                item.publishedAt || null,
              score: result.score,
              status:
                result.approved
                  ? "approved"
                  : "ignored",
              reasons: result.reasons
            },
            {
              onConflict: "external_id",
              ignoreDuplicates: true
            }
          )
          .select("id")
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          continue;
        }

        found++;

        if (result.approved) {
          const telegramTitle =
            cleanJobTitle(item.title);

          await telegramJob({
            title:
              telegramTitle ||
              "Vaga sem título",
            url: item.link,
            source: source.name,
            score: result.score
          });

          await database
            .from("jobs")
            .update({
              notified_at:
                new Date().toISOString()
            })
            .eq("id", data.id);

          sent++;
        }
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
    sent,
    errors
  };
}
