import {OpenAI} from "openai";

const openai = new OpenAI({
    apiKey: process.env.API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export default openai;