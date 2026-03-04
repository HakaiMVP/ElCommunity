import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    console.warn("Gemini API key is not configured in .env file.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Generates content using the Gemini API.
 * @param {string} prompt - The prompt to send to the model.
 * @returns {Promise<string>} - The generated text response.
 */
export async function generateGeminiContent(prompt) {
    try {
        if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
            throw new Error("Gemini API key is not configured.");
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating content with Gemini:", error);
        throw error;
    }
}

/**
 * Simple connection test for the Gemini API.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function testGeminiConnection() {
    try {
        const testPrompt = "Translate 'Hello, how are you?' to Portuguese.";
        const response = await generateGeminiContent(testPrompt);
        console.log("Gemini Test Response:", response);
        return true;
    } catch (error) {
        return false;
    }
}
