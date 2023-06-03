# Robot 1-X dependencies

At a minimum, you need to have the following available to launch Robot 1-X locally:

- Python packages installed
- .env.dev settings file
- Telegram bot token
- OpenAI API key 
- serper.dev API token

## Python packages

Robot 1-X is tested on Python 3.11.
He may or may not operate on older Python versions.

To install all dependencies, execute:

```pip3 install -r requirements.pip```

## .env.dev settings file

Copy .env.example to .env.dev.

## Telegram bot

Testing Robot 1-X requires, at a minimum, a Telegram bot.
You will need to create a bot, then update your bot's token and name under .env.dev.
The process takes about 2 minutes.

Creating a Telegram bot: https://core.telegram.org/bots/tutorial#obtain-your-bot-token.

After creating the bot, update the *TELEGRAM_BOT_TOKEN* and *TELEGRAM_BOT_NAME* parameters in .env.dev.

## OpenAI

Create an account with OpenAI: https://platform.openai.com.

Then, create an OpenAI API key, here: https://platform.openai.com/account/api-keys

Update *OPENAI_API_KEY* in .env.dev.

## serper.dev


