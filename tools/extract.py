#!/usr/bin/python3

import re
import json
import argparse

def extract_messages(log_file, output_file):
    with open(log_file, 'r') as log, open(output_file, 'w') as out:
        log_content = log.read()
        pattern = r"Starting getChatCompletionWithTools\.([\s\S]*?)(parsedMessages: \[[\s\S]*?\])"
        matches = re.findall(pattern, log_content)

        if matches:
            last_instance = matches[-1][-1]
            role_pattern = r"role: ['\"]([^'\"]*)['\"]"
            content_pattern = r"content: ['\"]([^'\"]*)['\"]"
            roles = re.findall(role_pattern, last_instance)
            contents = re.findall(content_pattern, last_instance)

            messages = { "messages" : [{"role": role, "content": content} for role, content in zip(roles, contents)] }

            with open(output_file, 'w') as out:
                json.dump(messages, out, indent=2)
        else:
            print("No matching instances found in the log file.")

# Replace 'input.log' and 'output.json' with your actual log and output file names
import re
import json

def extract_messages(log_file, output_file):
    with open(log_file, 'r') as log, open(output_file, 'w') as out:
        log_content = log.read()
        pattern = r"Starting getChatCompletionWithTools\.([\s\S]*?)(parsedMessages: \[[\s\S]*?\])"
        matches = re.findall(pattern, log_content)

        if matches:
            last_instance = matches[-1][-1]
            role_pattern = r"role: '([^']*)'"
            content_pattern = r"content: '([^']*)'"

            roles = re.findall(role_pattern, last_instance)
            contents = re.findall(content_pattern, last_instance)

            messages = { "messages" : [{"role": role, "content": content} for role, content in zip(roles, contents)] }

            with open(output_file, 'w') as out:
                json.dump(messages, out, indent=2)
        else:
            print("No matching instances found in the log file.")

# Replace 'input.log' and 'output.json' with your actual log and output file names
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Extract messages from a log file and save them to an output JSON file.')
    parser.add_argument('--input', required=True, help='Path to the input log file.')
    parser.add_argument('--output', required=True, help='Path to the output JSON file.')

    args = parser.parse_args()

    extract_messages(args.input, args.output)


