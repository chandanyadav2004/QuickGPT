import imagekit from "../config/imageKit.js";
import openai from "../config/openai.js";
import Chat from "../models/Chat.js";
import User from '../models/User.js';
import axios from 'axios';

// Text-Based AI Chat Message Controller
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // check credits
    if (req.user.credits < 1) {
      return res.status(402).json({ success: false, message: "You don't have enough credits to use this feature" });
    }

    const { chatId, prompt } = req.body;
    if (!chatId || !prompt) {
      return res.status(400).json({ success: false, message: "chatId and prompt are required" });
    }

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // add user message first
    const userMessage = {
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
      isPublished: true
    };
    chat.messages.push(userMessage);

    // Call model
    const { choices } = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Build reply and persist before responding
    const reply = { ...choices[0].message, timestamp: Date.now(), isImage: false };
    chat.messages.push(reply);

    // Save chat and decrement credits atomically-ish
    await chat.save();
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

    // log safely
     console.log("Model reply:", choices?.[0]?.message ?? reply); 

    // Single response after everything finished
    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("textMessageController error:", error);

    // If headers already sent, don't try to send again
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


// image generation Message controller
export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // check credits
    if (req.user.credits < 2) {
      return res.status(402).json({ success: false, message: "You don't have enough credits to use this feature" });
    }

    const { prompt, chatId, isPublished = true } = req.body;
    if (!prompt || !chatId) {
      return res.status(400).json({ success: false, message: "prompt and chatId are required" });
    }

    // find chat
    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // Push user message
    const userMessage = { role: "user", content: prompt, timestamp: Date.now(), isImage: false, isPublished };
    chat.messages.push(userMessage);

    // Encode prompt and construct generation URL
    const encodedPrompt = encodeURIComponent(prompt);
    const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

    // Trigger generation by fetching from ImageKit (returns image bytes)
    const aiImageResponse = await axios.get(generatedImageUrl, { responseType: 'arraybuffer' });

    // Convert to base64
    const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data, "binary").toString('base64')}`;

    // upload to imagekit Media Library
    const uploadResponse = await imagekit.upload({
      file: base64Image,
      fileName: `${Date.now()}.png`,
      folder: "quickgpt"
    });

    const reply = {
      role: "assistant",
      content: uploadResponse.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished,
    };

    // Push reply and persist
    chat.messages.push(reply);
    await chat.save();

    // decrement credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });

    // Only now respond
    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("imageMessageController error:", error);

    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


// API to get published images
export const getPublishedImages = async (req,res) => {
    
    try {
        const publishedImageMessages = await Chat.aggregate([
            {$unwind: "$messages"},
            {
                $match : {
                    "messages.isImage":true,
                    "messages.isPublished": true
                }
            },
            {
                $project: {
                    _id: 0,
                    imageUrl: "$messages.content",
                    userName: "$userName"
                }
            }
        ])

        res.json({success: true, images: publishedImageMessages.reverse()})
        
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}
