const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function getChatCompletion(messages) {
  const completion = await openai.createChatCompletion({
    model: process.env.OPENAI_MODEL,
    messages,
  });
  return completion.data.choices[0].message.content;
}

// TODO whisper
// async function getTranscript(filePath) {
//   const openedFile =
//   const transcript = openai.createTranscription()
// }

module.exports = {
  getChatCompletion,
};
