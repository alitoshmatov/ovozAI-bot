import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { configDotenv } from "dotenv";
import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";
import { translations } from "./translations.js";
import { message } from "telegraf/filters";
import cron from "node-cron";

configDotenv();

const commands = {
  language: "language",
  cyrillic: "kirill",
  latin: "lotin",
};

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

bot.command(commands.language, async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { telegramId: ctx.from.id.toString() },
  });
  ctx.reply(getMessage(user, "selectLanguage"), getLanguageKeyboard());
});

bot.command(commands.cyrillic, async (ctx) => {
  const user = await prisma.user.update({
    where: { telegramId: ctx.from.id.toString() },
    data: { isUsingCyrillic: true },
  });
  ctx.reply(getMessage(user, "cyrillicEnabled"));
});

bot.command(commands.latin, async (ctx) => {
  const user = await prisma.user.update({
    where: { telegramId: ctx.from.id.toString() },
    data: { isUsingCyrillic: false },
  });
  ctx.reply(getMessage(user, "latinEnabled"));
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
    const referrerId = parseInt(ctx.payload) || 0; // Convert to number or default to 0

    // Create or update user
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        referrerId: referrerId, // Store the referrer ID
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

  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  // Limit 1 hour
  if (user.totalAudioSeconds > 60 * 60 * 1 && !user.noLimit) {
    ctx.reply(getMessage(user, "limitReached"));
    notifyOwner(
      `User [${user.firstName}](tg://user?id=${user.telegramId}) reached the limit of 1 hour. Total audio seconds: ${user.totalAudioSeconds}`
    );
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
              text: `You are a helpful assistant that transcribes voice messages. If voice message is empty say: '_Audio does not contain any speech_'.${
                user.isUsingCyrillic ? "Use cyrillic letters." : ""
              }`,
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

    Promise.all([
      prisma.audio.create({
        data: {
          userId: user.id,
          duration: voice.duration,
          requestDuration,
          isSuccess: true,
        },
      }),
      prisma.user.update({
        where: { telegramId },
        data: { totalAudioSeconds: { increment: voice.duration } },
      }),
    ]).then(() => {});

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

const getSummary = async () => {
  try {
    // Get today's date at midnight
    const today = new Date();

    // Get yesterday's date at midnight
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // Get new users who signed up yesterday
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
      },
    });

    // Get audio transcriptions from yesterday
    const audioStats = await prisma.audio.aggregate({
      where: {
        createdAt: {
          gte: yesterday,
          lt: today,
        },
        isSuccess: true,
      },
      _count: {
        id: true,
      },
      _sum: {
        duration: true,
      },
    });

    // Format the duration in minutes and seconds
    const totalAudioMinutes = Math.floor((audioStats._sum.duration || 0) / 60);
    const totalAudioSeconds = (audioStats._sum.duration || 0) % 60;

    const summaryMessage =
      `📊 *Daily Summary Report*\n\n` +
      `📅 Date: ${yesterday.toLocaleDateString()}\n` +
      `👥 New Users: ${newUsers}\n` +
      `🎤 Total Transcriptions: ${audioStats._count.id}\n` +
      `⏱ Total Audio Length: ${totalAudioMinutes}m ${totalAudioSeconds}s`;

    notifyOwner(summaryMessage);
  } catch (error) {
    console.error("Error generating daily summary:", error);
    notifyOwner(`Error generating daily summary: ${error.message}`);
  }
};

const resetLimits = async () => {
  try {
    await prisma.user.updateMany({
      data: { totalAudioSeconds: 0 },
    });
    notifyOwner("✅ Limits have been reset");
  } catch (error) {
    notifyOwner(`Error resetting limits: ${error.message}`);
  }
};

cron.schedule("0 16 * * *", getSummary);

// Reset limits each month
cron.schedule("0 0 1 * *", resetLimits);

bot.catch((err, ctx) => {
  console.error("Error in bot:", err);
  notifyOwner(`Error in bot: ${err.message}`);
});

// Cleanup
process.once("SIGINT", async () => {
  await prisma.$disconnect();
  bot.stop("SIGINT");
});
process.once("SIGTERM", async () => {
  await prisma.$disconnect();
  bot.stop("SIGTERM");
});
