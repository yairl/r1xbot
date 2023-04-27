history = [
    {
      role: 'assistant',
      content: 'ANSWER: I apologize, but I cannot provide any information about Guy Caspary, as I could not find any relevant or notable persons with that name using my search capabilities. Can you please provide any additional context or details that may help me better understand who you are asking about?'
    },
    { role: 'user', content: 'Who is Guy Caspary?' },
    {
      role: 'assistant',
      content: 'Guy Caspary is an individual who has a professional profile on LinkedIn. Beyond this, I could not find any additional information about him or his background using my tools.'
    },
    {
      role: 'user',
      content: "What's the weather in Milan like tomorrow?"
    },
    {
      role: 'assistant',
      content: 'The weather in Milan, Italy tomorrow, according to the most recent forecast, is expected to be partly cloudy with a high of 21°C (70°F) and a low of 9°C (48°F).'
    },
    { role: 'user', content: 'Who is Aviram Yeruchami?' },
    {
      role: 'assistant',
      content: "Aviram Yeruchami is a Director of Engineering at Cisco, specifically for the company's Leaba division. Not much else is available in the public domain about his personal or professional background."
    },
    { role: 'user', content: 'What should I wear tomorrow?' },
    {
      role: 'assistant',
      content: 'Tool=search, tool_input=What is the weather forecast for tomorrow in my location?'
    },
    { role: 'user', content: 'What should I wear tomorrow?' },
    {
      role: 'assistant',
      content: 'Based on the weather forecast for your location, I would recommend checking the expected high and low temperatures for tomorrow, as well as the expected weather conditions (i.e. sunny, rainy, cloudy) to determine what to wear. If it is expected to be warm and sunny, you may want to wear light and comfortable clothing, while if it is expected to be cooler and potentially rainy, you may want to wear a jacket or other appropriate clothing to keep you warm and dry.'
    },
    { role: 'user', content: 'I am located in Milan.' },
    {
      role: 'assistant',
      content: 'Understood. Is there a specific question or topic you would like me to help with related to Milan?'
    },
    { role: 'user', content: 'What should I wear tomorrow?' },
    {
      role: 'assistant',
      content: "ANSWER: Based on the weather forecast for Milan, Italy, tomorrow, which is partly cloudy with highs of 21°C (70°F) and lows of 9°C (48°F), it is recommended that you wear comfortable clothing such as light shirts, pants or skirts, and a jacket or sweater to keep you warm in case the temperature drops. It's advisable to wear clothes in layers, to be prepared for fluctuations in temperatures."
    },

    {
      role: 'user',
      content: 'Who is the uk pm?'
    },
];

require("../src/utils/init-env-vars").config();

const { logger, createLoggingContext } = require("../src/utils/logger");
const { getChatCompletionWithTools } = require("../src/services/open-ai/query-openai");

const ctx = createLoggingContext(0);
const reply = getChatCompletionWithTools(ctx, 'wa', history, true);

console.log({reply});

