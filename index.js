import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { configDotenv } from "dotenv";
import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";
import { translations } from "./translations.js";
import { message } from "telegraf/filters";

configDotenv();

const OWNER_ID = 495553408;

const prisma = new PrismaClient();
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

function notifyOwner(message) {
  bot.telegram.sendMessage(OWNER_ID, message, {
    parse_mode: "Markdown",
  });
}
// Helper function to get message based on user's language
const getMessage = (user, key) => {
  return translations[user.language][key];
};

// Create language selection keyboard
const getLanguageKeyboard = () => {
  return Markup.keyboard([
    ["O'zbek 🇺🇿"],
    ["Русский 🇷🇺"],
    ["English 🇬🇧"],
  ]).resize();
};

bot.command("language", async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  });
  ctx.reply(getMessage(user, "selectLanguage"), getLanguageKeyboard());
});

// Handle language selection
bot.hears(["English 🇬🇧", "Русский 🇷🇺", "O'zbek 🇺🇿"], async (ctx) => {
  const languageMap = {
    "English 🇬🇧": "en",
    "Русский 🇷🇺": "ru",
    "O'zbek 🇺🇿": "uz",
  };

  const language = languageMap[ctx.message.text];
  const telegramId = ctx.from.id.toString();

  const user = await prisma.user.update({
    where: { telegramId },
    data: { language },
  });

  await ctx.reply(getMessage(user, "languageSet"), Markup.removeKeyboard());
  await ctx.reply(getMessage(user, "welcome"));
});

bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();

    // Create or update user
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
      },
      update: {
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
      },
    });

    // Show language selection on start
    await ctx.reply(
      translations[user.language].selectLanguage,
      getLanguageKeyboard()
    );
  } catch (error) {
    notifyOwner(
      `Error starting bot: ${error.message}
      User: \n\`${JSON.stringify(ctx.from)}\``
    );
    ctx.reply(translations.en.error);
  }
});

bot.on(message("voice"), async (ctx) => {
  const startTime = Date.now();
  // Show typing status
  await ctx.sendChatAction("typing");

  const voice = ctx.message.voice;

  if (voice.duration > 60 * 20) {
    ctx.reply(getMessage(user, "fileTooLarge"));
    return;
  }

  const telegramId = ctx.from.id.toString();
  const file = await ctx.telegram.getFileLink(voice.file_id);

  const user = await prisma.user.update({
    where: { telegramId },
    data: { totalAudioSeconds: { increment: voice.duration } },
  });

  // Limit 1 hour
  if (user.totalAudioSeconds > 60 * 60 * 1 && !user.noLimit) {
    ctx.reply(getMessage(user, "limitReached"));
    return;
  }

  try {
    const transcription = await generateText({
      model: google("gemini-2.0-flash"),

      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "You are a helpful assistant that transcribes voice messages. If voice message is empty say: '_Audio does not contain any speech_'. If language is in uzbek use cyrillic letters.",
            },
            {
              type: "file",
              data: file.href,
              mimeType: "audio/ogg",
            },
          ],
        },
      ],
    });

    // Request duration in seconds
    const requestDuration = (Date.now() - startTime) / 1000;

    prisma.audio
      .create({
        data: {
          userId: user.id,
          duration: voice.duration,
          requestDuration,
          isSuccess: true,
        },
      })
      .then(() => {});

    ctx.reply(transcription.text, {
      parse_mode: "Markdown",
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (error) {
    notifyOwner(
      `Error transcribing voice message: ${error.message}
      \nVoice: \n\`${JSON.stringify(ctx.message.voice)}\`
      \nUser: \n\`${JSON.stringify(ctx.from)}\``
    );
    console.error("Error transcribing voice message:", error);
    ctx.reply(getMessage(user, "error"));
  }
});

bot.launch();

// Cleanup
process.once("SIGINT", async () => {
  await prisma.$disconnect();
  bot.stop("SIGINT");
});
process.once("SIGTERM", async () => {
  await prisma.$disconnect();
  bot.stop("SIGTERM");
});
