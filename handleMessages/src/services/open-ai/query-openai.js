const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

function convertMessageToChatFormat(message) {
  const convertedMessage = {
    role: message.isSentByMe ? "assistant" : "user",
    content: message.body
  };
  return convertedMessage;
}

async function getChatCompletion(ctx, messages) {
  const parsedMessages = [
    {
      role: "system",
      content: `You are a helpful expert assistant, Robot 1-X, integrated into a Telegram chat. Today's date is ${new Date(
        Date.now()
      ).toDateString()}. More information about you is available at https://r1x.ai. When telling about yourself, prefer to provide the link as well.`
    }
  ];

  for (message of messages) {
    if (message.body == null) {
      continue;
    }
 
    parsedMessages.push(convertMessageToChatFormat(message));
  }

  console.log(`[${ctx}] getChatCompletion messages: `, parsedMessages); 

  const completion = await openai.createChatCompletion({
    model: process.env.OPENAI_MODEL,
    messages: parsedMessages
  });

  console.log(`[${ctx}] getChatCompletion response: `, completion);

  return completion.data.choices[0].message.content;
}

// TODO whisper
// async function getTranscript(filePath) {
//   const openedFile =
//   const transcript = openai.createTranscription()
// }

module.exports = {
  getChatCompletion
};
