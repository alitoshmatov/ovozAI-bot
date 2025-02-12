import { PrismaClient } from "@prisma/client";
import { Telegraf } from "telegraf";
import { translations } from "./translations.js";

const prisma = new PrismaClient();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const main = async () => {
  const audios = await prisma.audio.findMany({
    where: {
      isSuccess: false,
    },
    select: {
      user: {
        select: {
          telegramId: true,
          firstName: true,
          lastName: true,
          username: true,
          language: true,
        },
      },
    },
  });

  const sentUsers = [];

  audios.forEach((item) => {
    if (!sentUsers.includes(item.user.telegramId)) {
      sentUsers.push(item.user.telegramId);
      bot.telegram.sendMessage(
        item.user.telegramId,
        translations[item.user.language].fixedProblems
      );
    }
  });
};

main();
