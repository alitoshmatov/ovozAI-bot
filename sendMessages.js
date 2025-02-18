import { PrismaClient } from "@prisma/client";
import { configDotenv } from "dotenv";
import { Telegraf } from "telegraf";

configDotenv();

const message = {
  uz: "Endi meni guruhlarga qo‘shishingiz mumkin va men har bir ovozli xabarni avtomatik ravishda matn shaklida yozib beraman 📲✍️. \nIshlashim uchun meni admin qiling, shunda bot to‘liq faoliyat ko‘rsata oladi! 🔑",
  uz_cyrillic:
    "Энди мени гуруҳларга қўшишингиз мумкин ва мен ҳар бир овозли хабарни автоматик равишда матн шаклида ёзиб бераман 📲✍️. \nИшлашим учун мени админ қилинг, шунда бот тўлиқ фаолият кўрсата олади! 🔑",
  ru: "Теперь вы можете добавить меня в группы, и я буду автоматически транскрибировать каждое голосовое сообщение 📲✍️. Чтобы я работал, сделайте меня администратором! 🔑",
  en: "Now you can add me to the groups, and I will automatically transcribe each voice message 📲✍️. \nMake me an admin so I can work properly! 🔑",
};

const prisma = new PrismaClient();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

prisma.user
  .findMany()
  .then((res) => {
    res.forEach(async (user) => {
      console.log("Sending");
      await bot.telegram.sendMessage(user.telegramId, message[user.language]);
      console.log(
        `Sent to ${user.username} ${user.firstName} ${user.lastName} (${user.telegramId})`
      );
    });
  })
  .catch((e) => {
    console.log(e);
  });
