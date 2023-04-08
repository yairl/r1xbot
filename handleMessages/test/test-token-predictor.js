"use strict";
const assert = require('assert');
require("dotenv").config();
const tokenPredictor = require(".././src/services/token-prediction/token-predictor");

async function main() {
    const systemMessage = {"role": "system", "content": "you are a helpful bot"};

    const chatMessages = [
         {"role": "user", "content": "i'm your lord"},
         {"role": "assistant", "content": "you'd wish"},
         {"role": "user", "content": "מה אתה אומר"},
         {"role": "assistant", "content": "מה שאתה שומע"}
    ];

    // build the expected behavior. a map from number of tokens --> message list using the numTokensFromMessages predictor
    const numTokensToMessages = new Map();
    const previousMessages = [];
    let previousNumTokens = 0;
    const chatMessagesReversed = chatMessages.slice().reverse(); // make a copy of chatMessages and reverse it
    
    for (let numChatMessages = 0; numChatMessages <= chatMessagesReversed.length ; ++numChatMessages) {
        // take the first numChatMessages from the end
        const subsetChatMessagesReversed = chatMessagesReversed.slice(0, numChatMessages);

        // get back the normal order 
        const subsetChatMessages = subsetChatMessagesReversed.slice().reverse();

        // build the full list message
        const combinedMessages = [systemMessage, ...subsetChatMessages];

        // calculate their number of tokens
        const numTokens = await tokenPredictor.numTokensFromMessages(combinedMessages);

        // fill out the entries of token sizes for the unset sizes so far in the message map
        for (const token = previousNumTokens; token < numTokens; token++) {
            numTokensToMessages[token] = previousMessages;
        }

        // if this is the last iteration then nothing will fill in for it (no next), so do now
        if (numChatMessages == chatMessagesReversed.length) {
            
            numTokensToMessages[numTokens] = combinedMessages;
        }

        // update for next iteration
        previousMessages = combinedMessages;
        previousNumTokens = numTokens;
    }
    // console.log(numTokensToMessages);
     
      
    // verify that the message selector picks up exactly the expected messages. Go +10 beyond the last previousNumTokens just for checks.
    for (const maxTokens = 0; maxTokens < previousNumTokens+10; maxTokens ++) {
        const actualMessages = await tokenPredictor.getMessagesUptoMaxTokens(systemMessage, chatMessages, maxTokens);

        //console.log(`maxTokens=${maxTokens}\n  actual=${JSON.stringify(actualMessages)}\nexpected=${JSON.stringify(numTokensToMessages[maxTokens])}`);
        try {
            // if the number of tokens still exist int the map, compare to the map
            if (maxTokens <= previousNumTokens){
                assert.deepStrictEqual(actualMessages, numTokensToMessages[maxTokens]);
            } else {
                //compare the the full list
                assert.deepStrictEqual(actualMessages, previousMessages);
            }
        } catch (error) {
            console.log(`Actual and expected message list are different for ${maxTokens}\n`, error);
            throw error;
        }
    }
    
    // Get the index of the message within the chatMessages list from which messages should be taken.
    // const res = await tokenPredictor.getMessageIndexUptoMaxTokens(systemMessage, chatMessages, 17); console.log(res);

    // Get the number of tokens a list of messages should consume
    // tokens = await tokenPredictor.numTokensFromMessages(combined);  console.log("numTokensFromMessages", tokens);
}

main();

