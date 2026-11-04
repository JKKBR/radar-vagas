function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type TelegramJob = {
  position: string;
  company?: string;
  salary?: string;
  location?: string;
  vacancies?: string;
  experience?: string;
  extras?: string[];
  url: string;
  source: string;
  score: number;
};

export async function telegramJob(job: TelegramJob) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram não configurado");
  }

  const text = [
    "📢 <b>Nova vaga encontrada</b>",
    "",
    `💼 <b>${escapeHtml(job.title)}</b>`,
    "",
    `⭐ Compatibilidade: <b>${job.score}/100</b>`,
    `🔎 Fonte: ${escapeHtml(job.source)}`
  ].join("\n");

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔗 Ver anúncio",
                url: job.url
              }
            ]
          ]
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function telegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram não configurado");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Telegram: ${response.status}`);
  }

  return response.json();
}
