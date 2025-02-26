import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { configDotenv } from "dotenv";
import { Telegraf } from "telegraf";

configDotenv();

const message = {
  uz: "Meni o'z guruhingizga qo'shing 📢 va men ovozli xabarlarni avtomatik tarzda matnga o'girib beraman ✍️.",
  uz_cyrillic:
    "Мени ўз гуруҳингизга қўшинг 📢 ва мен овозли хабарларни автоматик тарзда матнга ўгириб бераман ✍️.",
  ru: "Добавьте меня в вашу группу 📢, и я автоматически преобразую голосовые сообщения в текст ✍️.",
  en: "Add me to your group 📢, and I will automatically convert voice messages into text ✍️.",
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
