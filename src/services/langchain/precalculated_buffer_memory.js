"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrecalculatedBufferMemory = void 0;
const base_js_1 = require("../../../node_modules/langchain/dist/memory/base.cjs");
const chat_memory_js_1 = require("../../../node_modules/langchain/dist/memory/chat_memory.cjs");
class PrecalculatedBufferMemory extends chat_memory_js_1.BaseChatMemory {
    constructor(fields) {
        super({
            returnMessages: fields?.returnMessages ?? false,
            chatHistory: fields?.chatHistory,
        });
        Object.defineProperty(this, "humanPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Human"
        });
        Object.defineProperty(this, "aiPrefix", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "AI"
        });
        Object.defineProperty(this, "memoryKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "history"
        });
        this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
        this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
        this.memoryKey = fields?.memoryKey ?? this.memoryKey;

        const rawMessages = fields?.messages ?? [];

        for (let i = 0; i < rawMessages.length; i++) {
          if (i % 2 == 0) {
            this.chatHistory.addUserMessage(rawMessages[i]);
          } else {
            this.chatHistory.addAIChatMessage(rawMessages[i]);
          }
        }
    }

    async saveContext(inputValues, outputValues) {
        console.log(`saveContext, inputValues = ${JSON.stringify(inputValues)}, outputValues = ${JSON.stringify(outputValues)}`);
        // this is purposefully done in sequence so they're saved in order
        this.userMessage = base_js_1.getInputValue(inputValues, this.inputKey);
        this.aiMessage = base_js_1.getInputValue(outputValues, this.outputKey);
    }

    async loadMemoryVariables(_values) {
        const messages = await this.chatHistory.getMessages();

        console.log( { messages } );

        if (this.returnMessages) {
            const result = {
                [this.memoryKey]: messages,
            };
            return result;
        }
        const result = {
            [this.memoryKey]: (0, base_js_1.getBufferString)(messages),
        };
        return result;
    }
}
exports.PrecalculatedBufferMemory = PrecalculatedBufferMemory;
