#!/usr/bin/python3

from langchain.chat_models import ChatOpenAI
from langchain.chains import LLMMathChain
from langchain.agents import Tool
from langchain.agents import AgentType
from langchain.agents import initialize_agent
from langchain.callbacks import get_openai_callback
from langchain.memory import ConversationBufferMemory
from langchain import GoogleSerperAPIWrapper

import argparse
import json

import dotenv
dotenv.load_dotenv('./.env.dev')



def complete(config):
  llm = ChatOpenAI(
    temperature=0,
  )

  google_serper = GoogleSerperAPIWrapper()
  google_tool = Tool(
        name = "Current Search",
        func = google_serper.run,
        description="useful for when you need to answer questions about events past September 2020, current events or the current state of the world"
    )

  tools = [google_tool]

  memory = ConversationBufferMemory(memory_key="chat_history")
  for idx, message in enumerate(config['messages'][0:-1]):
    if idx % 2 == 0:
      memory.chat_memory.add_user_message(message)
    else:
      memory.chat_memory.add_ai_message(message)

  agent = initialize_agent(
    agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
    tools=tools, 
    llm=llm,
    verbose=True,
    max_iterations=3,
    memory=memory,
  )

  agent(config['messages'][-1])

parser = argparse.ArgumentParser(description='Execute langchain agent.')
parser.add_argument('--config', type=str, dest='config_file', help='Config file, in JSON format.', required=True)
args = parser.parse_args()

with open(args.config_file, "r") as f:
  json_data = json.load(f)

complete(json_data)

