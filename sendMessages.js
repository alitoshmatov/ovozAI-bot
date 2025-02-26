import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { configDotenv } from "dotenv";
import { Telegraf } from "telegraf";

configDotenv();

const message = {
  uz: "Agar siz ushbu botni foydali deb topsangiz, iltimos, loyihamizni do‘stlaringiz bilan baham ko‘rish orqali qo‘llab-quvvatlang. Qancha ko‘p odam undan foydalansa, biz uni shuncha yaxshi qila olamiz! 🙌 Sizning qo‘llab-quvvatlashingiz biz uchun katta ahamiyatga ega! ❤️",
  uz_cyrillic:
    "Агар сиз ушбу ботни фойдали деб топсангиз, илтимос, лойиҳамизни дўстларингиз билан баҳам кўриш орқали қўллаб-қувватланг. Қанча кўп одам ундан фойдаланса, биз уни шунча яхши қила оламиз! 🙌 Сизнинг қўллаб-қувватлашингиз биз учун катта аҳамиятга эга! ❤️",
  ru: "Если этот бот оказался для вас полезным, пожалуйста, поддержите наш проект, поделившись им с друзьями. Чем больше людей им пользуются, тем лучше мы сможем его сделать! 🙌 Ваша поддержка очень важна для нас! ❤️",
  en: "If you find this bot useful, please support our project by sharing it with your friends. The more people use it, the better we can make it! 🙌 Your support means a lot to us! ❤️",
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
