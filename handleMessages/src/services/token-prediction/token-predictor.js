"use strict";

const assert = require('assert');
const logger = require("../../utils/logger");
const { Tiktoken } = require("@dqbd/tiktoken/lite");
const cl100k_base = require("@dqbd/tiktoken/encoders/cl100k_base.json");
const models = require("@dqbd/tiktoken/model_to_encoding.json");
const moment = require('moment');

// global variable to hold the encode objects between invocations
let encoder;

// Used just for test-verification to double check the actual tokens messages will take.
// This was verified against real results
//
// @returns the number of token a list of messages takes
async function numTokensFromMessages(messages) {
    if (!encoder) {
        throw new Error(`encoder is not initialized`);
    }

    /* Returns the number of tokens used by a list of messages. */
    let numTokens = 0;
    for (const message of messages) {
        numTokens += 4;  // every message follows <im_start>{role/name}\n{content}<im_end>\n
        for (const [key, value] of Object.entries(message)) {
            numTokens += encoder.encode(value).length;
            if (key === "name") {  // if there's a name, the role is omitted
                numTokens -= 1;  // role is always required and always 1 token
            }
        }
    }
    numTokens += 2;  // every reply is primed with <im_start>assistant

    numTokens += 1;  // ishumsky: not sure why, but the actual tokens are always + 1 from the prediction.
    return numTokens;
}

// @returns The number of tokens a single message takes.
function getMessageTokens(message) {
    if (Object.keys(message).length == 0 ) {
        // shouldn't really happen. just for tests, where the systemMessage is empty {}
        throw new Error(`message is malformed. Its ${message} but doesn't have any keys`);
    }

    let numTokens = 0;

    numTokens += 4;  // every message follows <im_start>{role/name}\n{content}<im_end>\n
    for (const [key, value] of Object.entries(message)) {
        numTokens += encoder.encode(value).length;
        if (key === "name") {  // if there's a name, the role is omitted
            numTokens -= 1;  // role is always required and always 1 token
        }
    }

    return numTokens;
}

// @returns {bool, int} Whether to include systemMessage (bool) and first index of chatMessages that'll take leq tokens than maxTokens
async function getMessageIndexUptoMaxTokens(systemMessage, chatMessages, maxTokens) {
    if (!encoder) {
        throw new Error(`encoder is not initialized`);
    }

    let numTokens = 0;
    numTokens += 2;  // every reply is primed with <im_start>assistant
    numTokens += 1;  // ishumsky: not sure why, but the actual tokens are always + 1 from the prediction.

    let includeSystemMessage = false; // dont include system message
    let startIndex = chatMessages.length; // first message to include is out of bounds

    // add up the system message
    numTokens += getMessageTokens(systemMessage);

    if (numTokens > maxTokens) {
        // if already out of tokens, bail
        return [includeSystemMessage, startIndex];
    }

    // there's enough tokens for systemMessage
    includeSystemMessage = true;

    // find the first token to start from, going from the end
    for (; startIndex >= 1; --startIndex) {
        let message = chatMessages[startIndex-1];

        numTokens += getMessageTokens(message);

        if (numTokens > maxTokens) {
            // if collected too many tokens then bail.
            break;
        }
    }

    return [includeSystemMessage, startIndex];
}

// @returns A list of messages comprised from systemMessage and last messages of chatMessages that will take leq tokens than maxTokens
async function getMessagesUptoMaxTokens(ctx, systemMessage, chatMessages, maxTokens) {
    logger.info(`[${ctx}] getMessagesUptoMaxTokens: chatMessages.length=${chatMessages.length}, maxTokens=${maxTokens}`);

    if (!encoder) {
        throw new Error('encoder is not initialized');
    }

    // get indication which messages to include
    let [includeSystemMessage, startIndex] = await getMessageIndexUptoMaxTokens(systemMessage, chatMessages, maxTokens);
    
    // initialize result
    let result = [];

    // bail early if even SystemMessage cannot fit system
    if (includeSystemMessage == false) {
        return result;
    }

    // resize the array for enough cells for:  system message(1) + items from chatMessages from startIndex till the end
    result.length = 1 + (chatMessages.length - startIndex);

    result[0] = systemMessage;

    for (let i = startIndex; i < chatMessages.length; i++) {
        let resultIndex = i-startIndex+1; // remove offset
        result[resultIndex] = chatMessages[i];
    }

    return result;
}

// Used to initialize the global var
function init() {
    let timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    logger.info(`${timestamp} ${__filename}:${init.name} started.`);
    try {
        assert.equal(models[process.env.OPENAI_MODEL], 'cl100k_base', `This code assumes that the model of ${process.env.OPENAI_MODEL} to be "cl100k_base", but got ${models[process.env.OPENAI_MODEL]}`);

        encoder = new Tiktoken(
            cl100k_base.bpe_ranks,
            cl100k_base.special_tokens,
            cl100k_base.pat_str
        );
    } catch (error) {
        console.log('Error occurred while initializing:', error);
    }
    timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    logger.info(`${timestamp} ${__filename}:${init.name} ended.`);
}

function cleanup() {
    // technically there's a new Tiktoken in this code, so it requires a cleanup.
    // for now, don't cleanup and just leak the memory.
    encoder.free();
}

// Initialize
init();
  
module.exports = {
    getMessagesUptoMaxTokens, numTokensFromMessages
};
  