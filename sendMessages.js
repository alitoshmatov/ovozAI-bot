import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { configDotenv } from "dotenv";
import { Telegraf } from "telegraf";

configDotenv();

const message = {
  uz: "Endi 20 daqiqagacha bo'lgan audio fayllarni ham matnga o'girishingiz mumkin.",
  uz_cyrillic:
    "Энди 20 дақиқагача бўлган аудио файлларни ҳам матнга ўгиришингиз мумкин.",
  ru: "Теперь вы можете преобразовать аудиофайлы длиной до 20 минут в текст.",
  en: "Now you can convert audio files up to 20 minutes long to text.",
};

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

const bot = new Telegraf("7884636818:AAEND5NTCSB7MfiQ7ToykCmRMDnLrvt_Y8o");

prisma.user
  .findMany()
  .then(async (res) => {
    for (const user of res) {
      console.log("Sending");
      try {
        await bot.telegram.sendMessage(user.telegramId, message[user.language]);

        console.log(
          `Sent to ${user.username} ${user.firstName} ${user.lastName} (${user.telegramId})`
        );
      } catch (e) {
        console.log(e);
      }
    }
  })
  .catch((e) => {
    console.log(e);
  });
