import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { configDotenv } from "dotenv";
import { Telegraf } from "telegraf";

configDotenv();

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply("Hello! Send me a voice message and I will transcribe it for you.");
});

bot.on("voice", async (ctx) => {
  const voice = ctx.message.voice;
  const file = await ctx.telegram.getFileLink(voice.file_id);
  console.log(file);
  const transcription = await generateText({
    model: google("gemini-1.5-flash"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "You are a helpful assistant that transcribes voice messages.",
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
  ctx.reply(transcription.text);
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
