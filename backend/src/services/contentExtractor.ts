import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ExtractedContent {
  title: string;
  textContent: string;
  htmlContent: string;
}

export async function extractContentFromUrl(
  url: string
): Promise<ExtractedContent> {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const dom = new JSDOM(response.data, { url });
    const document = dom.window.document;

    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      const title = document.title || url;
      const bodyText = document.body?.textContent || "";
      return {
        title: title.substring(0, 500),
        textContent: bodyText.substring(0, 10000),
        htmlContent: document.body?.innerHTML || "",
      };
    }

    return {
      title: article.title || url,
      textContent: article.textContent || article.content || "",
      htmlContent: article.content || "",
    };
  } catch (error: any) {
    throw new Error(`Failed to extract content from ${url}: ${error.message}`);
  }
}
