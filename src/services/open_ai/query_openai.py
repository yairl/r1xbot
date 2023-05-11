import json
import os
import openai
import time
import re
import requests
import traceback

from box import Box


from src.services.token_prediction import token_predictor
from langchain.utilities import google_serper

openai.api_key = os.environ['OPENAI_API_KEY']


def deep_clone(o):
    return json.loads(json.dumps(o))


def convert_message_to_chat_format(message):
    converted_message = {
        "role": "assistant" if message.isSentByMe else "user",
        "content": message.body,
    }
    return converted_message


def get_system_message(ctx, messenger_name):
    current_date = time.strftime("%B %d, %Y", time.gmtime()) 

    system_message = {
        "role": "system",
        "content": f"""You are Robot 1-X (R1X), a helpful, cheerful assistant developed by the Planet Express team and integrated into a {messenger_name} chat.
You are based on GPT-3.5 technology. More information about R1X is available at https://r1x.ai.
Today is {current_date}.

If Robot 1-X does not know, it truthfully says so.
If user asks for information that Robot 1-X does not have but can estimate, Robot 1-X will provide the estimate, while mentioning it is an estimate and not a fact.
Generally speaking, Robot 1-X tries to be verbose in his answers when possible."""
    }

    return system_message


def db_messages2messages(messages):
    parsed_messages = []

    for message in messages:
        if message.body is None:
            continue
        parsed_messages.append(convert_message_to_chat_format(message))

    return parsed_messages


def get_limited_message_history(ctx, messages, prompt_template):
    soft_token_limit = 2048
    hard_token_limit = 4000

    messages_upto_max_tokens = token_predictor.get_messages_upto_max_tokens(
        ctx, prompt_template, messages, soft_token_limit, hard_token_limit
    )

    if len(messages_upto_max_tokens) == 0:
        return []

    if messages_upto_max_tokens[0]["role"] == "assistant":
        messages_upto_max_tokens.pop(0)

    merged_messages = []
    prev_role = None

    for message in messages_upto_max_tokens:
        if message["role"] == prev_role:
            merged_messages[-1]["content"] += f"\n{message['content']}"
        else:
            merged_messages.append(message)

        prev_role = message["role"]

    return merged_messages


def get_chat_completion(ctx, messenger_name, messages, direct):
    parsed_messages = deep_clone(messages) if direct else db_messages2messages(messages)

    system_message = get_system_message(ctx, messenger_name)
    messages_upto_max_tokens = get_limited_message_history(
        ctx, parsed_messages, system_message
    )

    return get_chat_completion_core(ctx, messenger_name, messages_upto_max_tokens)

def get_chat_completion_core(ctx, messenger_name, messages):
    model = "gpt-4" if getattr(ctx, 'user_channel', None) == "canary" else "gpt-3.5-turbo"

    try:
        ctx.log("Messages: ", messages);
        ctx.log("invoking completion request.")
        completion = openai.ChatCompletion().create(
            model=model,
            messages=messages,
            temperature=0.2
        )

        ctx.log("getChatCompletionCore response: ", completion['choices'][0]['message']['content'])

        return Box({
            "response": completion['choices'][0]['message']['content'],
            "promptTokens": completion['usage']['prompt_tokens'],
            "completionTokens": completion['usage']['completion_tokens']
        })
    except Exception as e:
        if hasattr(e, "response"):
            ctx.log(f"error: e.response={e.response}")
        else:
            ctx.log("error: e={e}", e)

        ctx.log("error generating completion from OpenAI.")
        raise Exception("error generating completion from OpenAI.")


def get_prep_message(ctx, messenger):
    current_date = time.strftime("%B %d, %Y", time.gmtime())

    is_debug_prompt = False

    gpt_ver = 'GPT-4' if getattr(ctx, 'user_channel', None) == 'canary' else 'GPT-3.5'

    prep_message_stable = {
        "role" : "user",
        "content" : f"""You are Robot 1-X (R1X), a helpful, cheerful assistant developed by the Planet Express team and integrated into a {messenger} chat.
You are based on {gpt_ver} technology. More information about you is available at https://r1x.ai.

I will provide you with a chat between R1X and a human; the chat will be wrapped with tags, as such: <yair1xigor>CHAT</yair1xigor>. Last speaker is the user.
I will also provide you with data generated by previous tool invocations, which you can rely on for your answers; this data will be wrapped with tags, as such: <r1xdata>DATA</r1xdata>.

IMPORTANT: Before invoking a tool or providing an answer, follow these steps:
1. CHECK IF DATA FROM A TOOL IS ALREADY PROVIDED TO YOU in the <r1xdata> tag.
2. If data is provided in the <r1xdata> tag, DO NOT invoke the tool again.
3. Instead, use the provided data to create an appropriate answer to the user's request.

DO NOT CONTRADICT THAT DATA AND DO NOT DOUBT THAT DATA. THAT DATA SUPERSEDES ANY OTHER DATA YOU ARE AWARE OF.
DO NOT MENTION TO THE USER THIS DATA WAS RETURNED BY A SEARCH TOOL OR PROVIDED TO YOU IN ANY WAY.
DO NOT PROVIDE THE TOOL INVOCATION RESPONSE LINE IN YOUR REPLY.

Your task is to provide R1X's answer.

You can invoke one of the following tools to augment your knowledge before replying:

SEARCH: performs a Google search and returns key results. Use this tool to provide up-to-date information about world events. Its data is more reliable than your existing knowledge. TOOL_INPUT=search prompt. IMPORTANT: do not invoke this tool again if it was already invoked, and you have the result of the previous invocation.
WEATHER: per-location 3-day weather forecast, at day granularity. It does not provide a finer-grained forecast. TOOL_INPUT=<City, Country>, both in English. TOOL_INPUT should always be a well-defined settlement and country/state. IMPORTANT: If you believe the right value for TOOL_INPUT is unknown/my location/similar, do not ask for the tool to be invoked and instead use the ANSWER format to ask the user for location information.

For invoking a tool, provide your reply wrapped in <yair1xigoresponse>REPLY</yair1xigoresponse> tags, where REPLY is in JSON format with the following fields: TOOL, TOOL_INPUT.
Examples:

<yair1xigoresponse>{{ "TOOL" : "SEARCH", "TOOL_INPUT" : "Who is the current UK PM?" }}</yair1xigoresponse>
<yair1xigoresponse>{{ "TOOL" : "WEATHER", "TOOL_INPUT" : "Tel Aviv, Israel" }}</yair1xigoresponse>

Please use these exact formats, and do not deviate.

Otherwise, provide your final reply wrapped in <yair1xigoresponse>REPLY</yair1xigoresponse> tags in a JSON format, with the following fields: ANSWER.
Example:

<yair1xigoresponse>{{ "ANSWER" : "Current UK PM is Rishi Sunak" }}</yair1xigoresponse>

Today's date is {current_date}.
You are trained with knowledge until September 2021.
For factual information about people, stocks and world events, use one of the tools available to you before replying.
For fiction requests, use your knowledge and creativity to answer. Be verbose.
If human request has no context of time, assume he is referring to current time period.
In all cases, do not respond that your knowledge is not up to date unless a tool invocation has already happened for you in that context. Additionally, do not invoke a tool if the required TOOL_INPUT is unknown, vague, or not provided. Always follow the IMPORTANT note in the tool description.
Try to be verbose in your answers; if you have missing data and ONLY if you cannot use the tools provided to fetch it, try to estimate; in these cases, let the user know your answer is an estimate.
Finally, do not invoke a tool if the required information was already provided by a previous tool invocation, whose data is provided to you.

Don't provide your response until you made sure it is valid, and meets all prerequisites laid out for tool invocation.

WHEN PROVIDING A FINAL ANSWER TO THE USER, NEVER MENTION THE SEARCH AND WEATHER TOOLS DIRECTLY, AND DO NOT SUGGEST THAT THE USER UTILIZES THEM.

Your thought process should follow the next steps {'audibly stating the CONCLUSION for each step number without quoting it:' if is_debug_prompt else 'silently:'}
1. Understand the human's request and formulate it as a self-contained question.
2. Decide which tool should be invoked can provide the most information, and with what input. Decide all prerequisites for the tool and show how each is met. IMPORTANT: it is not allowed to invoke a tool that already has data provided to in in the <r1xdata> section.
3. Formulate the tool invocation request, or answer, in JSON format as detailed above. IMPORTANT: THIS PART MUST BE DELIVERED IN A SINGLE LINE. DO NOT USE MULTILINE SYNTAX.

IMPORTANT: Make sure to focus on the most recent request from the user, even if it is a repeated one.""" }

    return prep_message_stable

prep_reply_message = {"role": "assistant", "content": "Understood. Please provide me with the chat between R1X and the human."}

import datetime

def get_chat_completion_with_tools(ctx, messenger_name, messages, direct):
    try:
        ctx.log("Starting getChatCompletionWithTools.")

        parsed_messages = deep_clone(messages) if direct else db_messages2messages(messages)
        ctx.log({"messages": parsed_messages})

        prev_responses = []

        system_message = get_system_message(ctx, messenger_name)
        history = get_limited_message_history(ctx, parsed_messages, system_message)

        for i in range(2):
            ctx.log(f"Invoking completionIterativeStep #{i}")
            result = completion_iterative_step(ctx, messenger_name, deep_clone(history), prev_responses)
            answer = result['answer']
            tool = result['tool']
            input_ = result['input']
            prompt_tokens = result['prompt_tokens']
            completion_tokens = result['completion_tokens']

            ctx.log(f"completionIterativeStep done, answer={answer} tool={tool} input={input_} prompt_tokens={prompt_tokens} completion_tokens={completion_tokens}" )

            if answer:
                ctx.log(f"Answer returned: {answer}")

                return Box({
                    "response": answer,
                    "promptTokens": prompt_tokens,
                    "completionTokens": completion_tokens
                })

            if tool and input_:
                ctx.log(f"Invoking TOOL {tool} with INPUT {input_}")
                response = invoke_tool(ctx, tool, input_)
                prev_responses.append(f"INVOKED TOOL={tool}, TOOL_INPUT={input_}, ACCURACY=100%, INVOCATION DATE={datetime.datetime.now().date()} RESPONSE={response}")

    except Exception as e:
        ctx.log({"e": e})
        traceback.print_exc();

    ctx.log("getChatCompletionWithTools: failed generating customized reply, falling back to getChatCompletion.")

    return get_chat_completion(ctx, messenger_name, messages, direct)

def completion_iterative_step(ctx, messenger_name, history, prev_responses):
    result = {'answer': None, 'tool': None, 'input': None, 'prompt_tokens': None, 'completion_tokens': None}

    messages = []

    new_request = {'role': 'user', 'content': ''}
    new_request['content'] += 'Here is the chat so far:\n<yair1xigor>'

    for message in history:
        speaker = 'R1X' if message['role'] == 'assistant' else 'Human'
        new_request['content'] += f'\n<{speaker}>: {message["content"]}'

    new_request['content'] += '\n<R1X:></yair1xigor>'

    if prev_responses:
        prev_responses_flat = '\n'.join(prev_responses)
        new_request['content'] += f'\nhere is the data so far:\n\n<r1xdata>{prev_responses_flat}</r1xdata>\n'

    prep_message = get_prep_message(ctx, messenger_name)
    messages.append(prep_message)
    messages.append(prep_reply_message)

    messages.append(new_request)

    reply = get_chat_completion_core(ctx, messenger_name, messages)
    result['prompt_tokens'] = reply.promptTokens
    result['completion_tokens'] = reply.completionTokens

    regex = re.compile(r'<yair1xigoresponse>(.*?)<\/yair1xigoresponse>', re.DOTALL)
    matches = regex.search(reply['response'])

    if not matches:
        return result

    json_reply = eval(matches.group(1))
    ctx.log(f'completionIterativeStep: matched response: {json_reply}')

    result['answer'] = json_reply.get('ANSWER')
    if result['answer']:
        return result

    if json_reply.get('TOOL') and json_reply.get('TOOL_INPUT'):
        result['tool'] = json_reply.get('TOOL')
        result['input'] = json_reply.get('TOOL_INPUT')
        return result

    return result

def invoke_tool(ctx, tool, input):
    tool_canon = tool.strip().upper()

    if tool_canon.startswith('SEARCH'):
        # Replace this with an appropriate call to the Serper module
        ctx.log(f'Invoking Google search using SERPER, input={input}')
        serper = google_serper.GoogleSerperAPIWrapper(serper_api_key=os.environ['SERPER_API_KEY'])
        answer = serper.run(input)
        ctx.log(f'SERPER search result: {answer}')

        return answer

    if tool_canon.startswith('WEATHER'):
        answer = invoke_weather_search(ctx, input)

        return answer

    return None

def parse_geolocation(location_data):
    regex = re.compile(r'^(\d+\.\d+)\° ([NSEW]),\s*(\d+\.\d+)\° ([NSEW])$')
    match = regex.match(location_data)

    if not match:
        return None

    lat = float(match.group(1)) * (-1 if match.group(2) == 'S' else 1)
    lon = float(match.group(3)) * (-1 if match.group(4) == 'W' else 1)

    return Box({'lat': lat, 'lon': lon})

def invoke_weather_search(ctx, input):
    ctx.log(f'invokeWeatherSearch, input={input}')

    # Replace this with an appropriate call to the Serper module
    # serper = Serper()
    geo_prompt = f'{input} long lat'
    ctx.log(f'Invoking geolocation search using SERPER, input={geo_prompt}')
    serper = google_serper.GoogleSerperAPIWrapper(serper_api_key=os.environ['SERPER_API_KEY'])
    geo_res = serper.run(geo_prompt)
    ctx.log(f'SERPER geolocation result: {geo_res}')

    geo = parse_geolocation(geo_res)
    if not geo:
        return None

    ctx.log(f'Geolocation: lat={geo.lat} lon={geo.lon}')

    w_res = requests.get(f'https://api.open-meteo.com/v1/forecast?latitude={geo.lat}&longitude={geo.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_hours,precipitation_probability_max,windspeed_10m_max&forecast_days=3&timezone=auto')
    w_res_json = w_res.json()

    return json.dumps(w_res_json['daily'])

def create_transcription(ctx, mp3_file_path):
    t0 = time.time()

    transcript = openai.Audio.transcribe(
        file = open(mp3_file_path, "rb"),
        model = os.environ['OPENAI_SPEECH_TO_TEXT_MODEL']
    )

    transcription = transcript['text']
    time_taken = int((time.time() - t0) * 1000)

    ctx.log(f'createTranscription: timeTaken={time_taken}ms transcription={transcription}')

    return transcription

