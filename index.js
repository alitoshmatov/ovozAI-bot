// import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { configDotenv } from "dotenv";
configDotenv();

import { generateText } from "ai";
import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";
import { translations } from "./translations.js";
import { message } from "telegraf/filters";
import cron from "node-cron";
import { vertex } from "@ai-sdk/google-vertex";
import axios from "axios";
import { TEXT_PROMPT } from "./config.js";

const BOT_USERNAME = process.env.BOT_USERNAME;

const commands = {
  language: "language",
};

const OWNER_ID = 495553408;

const prisma = new PrismaClient();
// const google = createGoogleGenerativeAI({
//   apiKey: process.env.GOOGLE_API_KEY,
// });

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// bot.use(async (ctx, next) => {
//   try {
//     console.log(ctx.update);
//     const update = await prisma.update.upsert({
//       where: { id: ctx.update.update_id?.toString() || "" },
//       update: { handled: { increment: 1 } },
//       create: { id: ctx.update.update_id?.toString() },
//     });

//     if (update.handled > 2) {
//       console.log("Update handled more than 2 times", ctx.update.id);
//       return;
//     }

//     await next();
//   } catch (error) {
//     console.log("Error in bot update");
//     console.log(error);
//   }
// });

function notifyOwner(message) {
  bot.telegram
    .sendMessage(OWNER_ID, message, {
      parse_mode: "Markdown",
    })
    .catch((e) => {});
}
// Helper function to get message based on user's language
const getMessage = (user, key) => {
  return translations[user.language][key];
};

// Create language selection keyboard
const getLanguageKeyboard = () => {
  return Markup.keyboard([
    ["O'zbek 🇺🇿", "Ўзбек 🇺🇿"],
    ["Русский 🇷🇺"],
    ["English 🇬🇧"],
  ]).resize();
};

// Helper function to safely send messages
const safeSendMessage = async (ctx, text, options = {}) => {
  try {
    return await ctx.reply(text, options);
  } catch (error) {
    if (error.response?.error_code === 403) {
      console.log(`User ${ctx.from?.id} has blocked the bot`);
      return null;
    }
    console.log(error);
    // throw error;
  }
};

const isAdmin = async (ctx) => {
  try {
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    const member = await ctx.telegram
      .getChatMember(chatId, userId)
      .catch((e) => {});

    if (["administrator", "creator"].includes(member.status)) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

const isGroup = (ctx) => {
  return ctx.chat.type === "group" || ctx.chat.type === "supergroup";
};

bot.command(commands.language, async (ctx) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });
    await safeSendMessage(
      ctx,
      getMessage(user, "selectLanguage"),
      getLanguageKeyboard()
    );
  } catch (error) {
    console.error(`Error in language command: ${error.message}`);
  }
});

bot.on(message("new_chat_members"), async (ctx) => {
  const botId = ctx.botInfo.id;

  // Check if the bot is among new members
  const botMember = ctx.message.new_chat_members.find(
    (member) => member.id === botId
  );

  if (botMember) {
    console.log("✅ Bot added to group:", ctx.chat.title);
    const group = await prisma.group.upsert({
      where: { telegramId: ctx.chat.id.toString() },
      create: {
        telegramId: ctx.chat.id.toString(),
        title: ctx.chat.title,
        isKicked: false,
      },
      update: {
        title: ctx.chat.title,
        isKicked: false,
      },
    });
    await safeSendMessage(ctx, getMessage(group, "addedToGroup"));
  }
});

// Handle bot removal
bot.on(message("left_chat_member"), async (ctx) => {
  const botId = ctx.botInfo.id;

  if (ctx.message.left_chat_member.id === botId) {
    await prisma.group.update({
      where: { telegramId: ctx.chat.id.toString() },
      data: { isKicked: true },
    });
  }
});

// Handle bot status changes (for admin promotion)
bot.on("my_chat_member", async (ctx) => {
  const chatMember = ctx.update.my_chat_member;
  const newStatus = chatMember.new_chat_member.status;
  const oldStatus = chatMember.old_chat_member.status;
  const botId = ctx.botInfo.id;

  if (chatMember.new_chat_member.user.id === botId) {
    if (oldStatus !== "administrator" && newStatus === "administrator") {
      const group = await prisma.group.upsert({
        where: { telegramId: ctx.chat.id.toString() },
        create: {
          telegramId: ctx.chat.id.toString(),
          title: ctx.chat.title,
          isKicked: false,
        },
        update: {
          title: ctx.chat.title,
          isKicked: false,
        },
      });
      await safeSendMessage(ctx, getMessage(group, "promotedToAdmin"));
    }
  }
});

// Handle language selection
bot.hears(
  ["English 🇬🇧", "Русский 🇷🇺", "O'zbek 🇺🇿", "Ўзбек 🇺🇿"],
  async (ctx) => {
    try {
      const languageMap = {
        "English 🇬🇧": "en",
        "Русский 🇷🇺": "ru",
        "O'zbek 🇺🇿": "uz",
        "Ўзбек 🇺🇿": "uz_cyrillic",
      };

      const language = languageMap[ctx.message.text];
      const telegramId = ctx.from.id.toString();

      if (isGroup(ctx)) {
        const group = await prisma.group.update({
          where: { telegramId: ctx.chat.id.toString() },
          data: { language },
        });
        await safeSendMessage(
          ctx,
          getMessage(group, "languageSet"),
          Markup.removeKeyboard()
        );
      } else {
        const user = await prisma.user.update({
          where: { telegramId },
          data: { language },
        });

        await safeSendMessage(
          ctx,
          getMessage(user, "languageSet"),
          Markup.removeKeyboard()
        );
        await safeSendMessage(ctx, getMessage(user, "welcome"));
      }
    } catch (error) {
      console.error(`Error in language selection: ${error.message}`);
    }
  }
);

bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id.toString();
    const referrerId = ctx.payload;

    // Create or update user
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
        // referrerId: referrerId || "", // Store the referrer ID
      },
      update: {
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        username: ctx.from.username,
      },
    });

    // Show language selection on start
    await safeSendMessage(
      ctx,
      getMessage(user, "selectLanguage"),
      getLanguageKeyboard()
    );
    notifyOwner(
      `New [user](tg://user?id=${telegramId}) (${telegramId}) started the bot referrer ${
        referrerId ? `[user](tg://user?id=${referrerId})` : "none"
      }`
    );
  } catch (error) {
    notifyOwner(
      `Error starting bot: ${error.message}
      User: \n\`${JSON.stringify(ctx.from)}\``
    );

    safeSendMessage(ctx, getMessage(user, "error"));
  }
});

bot.on(message("voice"), async (ctx) => {
  try {
    const startTime = Date.now();
    // Show typing status
    await ctx.sendChatAction("typing").catch((e) => {});

    const voice = ctx.message.voice;
    const telegramId = ctx.from.id.toString();

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: {
        firstName: true,
        language: true,
        totalAudioSeconds: true,
        noLimit: true,
        referrerId: true,
        id: true,
        telegramId: true,
        _count: {
          select: {
            audios: {
              where: {
                isSuccess: true,
              },
            },
          },
        },
      },
    });

    // Default to English if user not found
    const userLanguage = user?.language || "en";

    if (voice.duration > 60 * 20) {
      await safeSendMessage(
        ctx,
        translations[userLanguage].fileTooLarge || "File too large"
      );
      return;
    }

    const group = isGroup(ctx)
      ? await prisma.group.findUnique({
          where: { telegramId: ctx.chat.id.toString() },
        })
      : null;

    if (!isGroup(ctx)) {
      // Limit 1 hour
      if (user?.totalAudioSeconds > 60 * 60 * 1 && !user?.noLimit) {
        await safeSendMessage(
          ctx,
          translations[userLanguage].limitReached || "Limit reached"
        );
        notifyOwner(
          `User [${user?.firstName}](tg://user?id=${user?.telegramId}) reached the limit of 1 hour. Total audio seconds: ${user?.totalAudioSeconds}`
        );
        return;
      }
    } else {
      if (!group) {
        await prisma.group.create({
          data: {
            telegramId: ctx.chat.id.toString(),
            title: ctx.chat.title,
            isKicked: false,
          },
        });
      } else {
        if (group.totalAudioSeconds > 60 * 60 * 2) {
          await safeSendMessage(
            ctx,
            translations[group.language || "en"].maxLimitReached(2),
            {
              disable_notification: true,
            }
          );
          notifyOwner(
            `Group [${group.title}](tg://user?id=${group.telegramId}) reached the limit of 2 hour. Total audio seconds: ${group.totalAudioSeconds}`
          );
          return;
        }
      }
    }

    const fileLink = await ctx.telegram.getFileLink(voice.file_id);

    try {
      // Download the file
      const response = await axios.get(fileLink.href, {
        responseType: "arraybuffer",
      });
      const audioData = Buffer.from(response.data);

      const transcription = await generateText({
        model: vertex("gemini-2.0-flash"),
        maxRetries: 1,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a helpful assistant that transcribes voice messages. If voice message is empty say: '_Audio does not contain any speech_'.${
                  user?.language === "uz_cyrillic"
                    ? "Use cyrillic letters."
                    : ""
                }`,
              },
              {
                type: "file",
                data: audioData,
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
            userId: user?.id,
            duration: voice.duration,
            requestDuration,
            isSuccess: true,
            groupId: isGroup(ctx) ? group?.id : null,
          },
        }),
        isGroup(ctx)
          ? prisma.group.update({
              where: { telegramId: ctx.chat.id.toString() },
              data: { totalAudioSeconds: { increment: voice.duration } },
            })
          : prisma.user.update({
              where: { telegramId },
              data: { totalAudioSeconds: { increment: voice.duration } },
            }),
      ]).then(() => {});

      const shouldShare =
        user?._count?.audios !== 0 && (user?._count?.audios + 1) % 5 === 0;

      await safeSendMessage(
        ctx,
        `${transcription.text}
${
  shouldShare
    ? `\n<blockquote>${translations[userLanguage].shareToSupport}</blockquote>`
    : ""
}`,
        {
          parse_mode: "HTML",
          reply_to_message_id: ctx.message.message_id,
          reply_markup: shouldShare
            ? Markup.inlineKeyboard([
                [
                  Markup.button.url(
                    translations[userLanguage].shareBot,
                    `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${user.telegramId}&text=\n\n${translations[userLanguage].shareBotText}`
                  ),
                ],
              ]).reply_markup
            : null,
        }
      );
    } catch (error) {
      const requestDuration = (Date.now() - startTime) / 1000;

      prisma.audio
        .create({
          data: {
            userId: user?.id || null,
            duration: voice.duration,
            requestDuration,
            isSuccess: false,
            groupId: isGroup(ctx) ? group?.id : null,
          },
        })
        .then((res) => {
          // console.log(res);
        })
        .catch((e) => {
          console.log(e);
        });
      notifyOwner(
        `Error transcribing voice message: ${error.message}
        \nVoice: \n\`${JSON.stringify(ctx.message.voice)}\`
        \nUser: \n\`${JSON.stringify(ctx.from)}\``
      );
      console.error("Error transcribing voice message:", error);
      await safeSendMessage(ctx, getMessage(user, "error"));
    }
  } catch (error) {
    console.error("Error in voice message handler:", error);
    await safeSendMessage(ctx, getMessage(user, "error"));
  }
});

// bot.on(message("text"), async (ctx) => {
//   // Do not answer if group, only answer when mentioned
//   const isMentioned = ctx.message.text.includes(`@${BOT_USERNAME}`);

//   if (isGroup(ctx)) {
//     return;
//   }

//   await ctx.sendChatAction("typing").catch((e) => {});

//   const user = await prisma.user.findUnique({
//     where: { telegramId: ctx.from.id.toString() },
//   });

//   if (!user) {
//     return;
//   }

//   if (user.textMessageTokens >= 1000000) {
//     await safeSendMessage(ctx, "Token limit reached");
//     notifyOwner(
//       `User [${user.firstName}](tg://user?id=${user.telegramId}) reached the limit of 1 million tokens. Text message tokens: ${user.textMessageTokens}`
//     );
//     return;
//   }

//   const answer = await generateText({
//     model: vertex("gemini-2.0-flash"),
//     maxRetries: 1,
//     messages: [
//       {
//         role: "system",
//         content: TEXT_PROMPT(user.language),
//       },
//       {
//         role: "user",
//         content: ctx.message.text,
//       },
//     ],
//   });
//   prisma.user
//     .update({
//       where: { telegramId: ctx.from.id.toString() },
//       data: {
//         textMessageCount: { increment: 1 },
//         textMessageTokens: { increment: answer.usage.totalTokens },
//       },
//     })
//     .then((res) => {});
//   await safeSendMessage(ctx, answer.text, {
//     reply_to_message_id: isMentioned ? ctx.message.message_id : undefined,
//   });
// });

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

bot.catch(async (err, ctx) => {
  console.error("Bot error:", err);

  try {
    // Try to get basic context information safely
    const errorInfo = {
      updateType: ctx?.updateType,
      userId: ctx?.from?.id,
      chatId: ctx?.chat?.id,
      messageId: ctx?.message?.message_id,
      error: {
        message: err.message,
        stack: err.stack,
      },
    };

    // Notify owner with structured error information
    await notifyOwner(
      `🚨 Bot Error Report:\n\`\`\`json\n${JSON.stringify(
        errorInfo,
        null,
        2
      )}\n\`\`\``
    );

    // If we have context, try to notify the user
    if (ctx) {
      const user = ctx.from?.id
        ? await prisma.user.findUnique({
            where: { telegramId: ctx.from.id.toString() },
          })
        : null;

      await safeSendMessage(
        ctx,
        translations[user?.language || "en"].error ||
          "An error occurred. Please try again later.",
        { reply_to_message_id: ctx.message?.message_id }
      ).catch(() => {
        /* Ignore send errors */
      });
    }
  } catch (notificationError) {
    // Last resort error logging if notification fails
    console.error("Error in error handler:", notificationError);
  }
});

bot
  .launch({
    dropPendingUpdates: true,
    // webhook: {
    //   // Public domain for webhook; e.g.: example.com
    //   domain: "bot.e-clinic.uz",

    //   // Port to listen on; e.g.: 8080
    //   port: 3010,

    //   // Optional path to listen for.
    //   // `bot.secretPathComponent()` will be used by default
    //   path: "/updates",

    //   // Optional secret to be sent back in a header for security.
    //   // e.g.: `crypto.randomBytes(64).toString("hex")`
    //   // secretToken: randomAlphaNumericString,
    // },
  })
  .then(() => {
    console.log("Bot started with all previous updates dropped.");
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
