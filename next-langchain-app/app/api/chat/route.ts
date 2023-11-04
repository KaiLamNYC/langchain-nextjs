// 1. Import necessary modules for chat functionality and schema validation

//USED FOR CUSTOM FUNCTIONS LATER ON
import { DynamicStructuredTool, DynamicTool } from "langchain/tools";

//IMPORT OPENAI MODEL
import { ChatOpenAI } from "langchain/chat_models/openai";

//  c. Import the initializeAgentExecutorWithOptions function for setting up the agent executor
import { initializeAgentExecutorWithOptions } from "langchain/agents";

//  d. Import the WikipediaQueryRun class for fetching information from Wikipedia
import { WikipediaQueryRun } from "langchain/tools";

//  e. Import the StreamingTextResponse class for streaming text responses
import { LangChainStream, Message, StreamingTextResponse } from "ai";

//ZOD SCHEMA VAIDATION FOR STRUCTURED TOOL
import * as z from "zod";

//AXIOS INSTEAD OF FETCH
// import axios from "axios";

//LANGCHAIN SCHEMAS
//https://js.langchain.com/docs/api/schema/classes/AIMessage
// import { AIMessage, HumanMessage } from "langchain/schema";

//EDGE RUNTIME
export const runtime = "edge";

export async function POST(req: Request) {
	// 4. Extract message data from incoming request
	const { messages } = await req.json();

	// 5. Initialize the ChatOpenAI model with specified configurations
	//https://js.langchain.com/docs/api/chat_models_openai/classes/ChatOpenAI
	const model = new ChatOpenAI({ temperature: 0, streaming: true });

	// 6. Set up a Wikipedia query tool for fetching relevant information
	//https://js.langchain.com/docs/api/tools/classes/WikipediaQueryRun
	const WikipediaQuery = new WikipediaQueryRun({
		//TOP RESULT
		topKResults: 1,
		//LENGTH OF DESCRIPTION
		maxDocContentLength: 300,
	});

	// 7. EXAMPLE DYNAMIC TOOL THAT ACCESPTS AND RETURNS A STRING
	// https://js.langchain.com/docs/modules/agents/tools/how_to/dynamic
	//js.langchain.com/docs/api/tools/classes/DynamicTool
	const oneShot = new DynamicTool({
		name: "oneShot",
		//DESCRIBE THE FUNCTION
		description:
			"call this to get the answer to with the game on the line, one shot, who would you rather have taking it?",
		func: async () => {
			console.log("BLOCKED BY JAMES");
			return "Of everyone on Golden State, open shot, the fate of the universe on the line, the Martians have the death beam pointed at earth, you better hit it, I WANT IGUODALA!";
		},
	});
	// 8. Define a structured tool to fetch cryptocurrency prices from CoinGecko API
	const fetchCryptoPrice = new DynamicStructuredTool({
		name: "fetchCryptoPrice",
		description:
			"Fetches the current crypto price of a specific cryptocurrency ",
		//TS VALIDATION FOR ARGS OPTIONS
		schema: z.object({
			cryptoName: z.string(),
			vsCurrency: z.string().optional().default("USD"),
		}),
		func: async (options) => {
			//LOGGING THE ARGS
			console.log("fetching crypto prices", options);
			//DESTRUCTURE
			const { cryptoName, vsCurrency } = options;
			//API URL WITH ARGS
			const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoName}&vs_currencies=${vsCurrency}`;
			//FETCH API
			const response = await fetch(url);
			//RESPONSE DATA
			const data = await response.json();
			//PARSING THE RESPONSE USING OUR ARGS TO RETURN TO USER
			// {
			// 	"usd": {
			// 	  "cad": 1.37
			// 	}
			//   }
			return data[cryptoName.toLowerCase()][
				vsCurrency.toLowerCase()
			].toString();
		},
	});

	//HELPER SCHEMA FOR DATE VALIDATION
	// const DateSchema = z
	// 	.string()
	// 	.regex(/^\d{4}-\d{2}-\d{2}$/)
	// 	.refine((date) => /^\d{4}-\d{2}-\d{2}$/.test(date), {
	// 		message: "Date must be in YYYY-MM-DD format",
	// 	});

	//FUNCTION TO GET NBA PLAYER STATS
	const fetchNBAGames = new DynamicStructuredTool({
		name: "fetchNBAGames",
		description: "Fetches a list of NBA Games played on a specific date",
		//TS VALIDATION FOR ARGS OPTIONS
		schema: z.object({
			date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			// seasons: z.array(z.string()).optional(),
			// player_ids: z.array(z.number()).optional(),
			// game_ids: z.array(z.number()).optional(),
			// postseason: z.boolean().optional(),
			// start_date: DateSchema.optional(),
			// end_date: DateSchema.optional(),
		}),
		func: async (options) => {
			//LOGGING THE ARGS
			console.log("fetching nba stats", options);

			// function toQueryString(params: any) {
			// 	return Object.keys(params)
			// 		.map((key) => {
			// 			const value = params[key];
			// 			if (Array.isArray(value)) {
			// 				// Handle array values by suffixing the key with []
			// 				return value
			// 					.map(
			// 						(item) =>
			// 							`${encodeURIComponent(key)}[]=${encodeURIComponent(item)}`
			// 					)
			// 					.join("&");
			// 			}
			// 			// Handle non-array values normally
			// 			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
			// 		})
			// 		.join("&");
			// }

			// const queryParams = {
			// 	dates: options.dates || [],
			// 	seasons: options.seasons || [],
			// 	player_ids: options.player_ids || [],
			// 	game_ids: options.game_ids || [],
			// 	postseason: options.postseason || false,
			// 	start_date: options.start_date || "",
			// 	end_date: options.end_date || "",
			// };

			// Serialize queryParams to a query string
			// const queryString = toQueryString(queryParams);
			// console.log(queryString);
			const { date } = options;
			const url = `https://www.balldontlie.io/api/v1/games?dates[]=${date}`;

			const response = await fetch(url);
			//RESPONSE DATA
			const data = await response.json();
			console.log("got data back");
			console.log(data);
			return data.toString();

			//PARSING THE RESPONSE USING OUR ARGS TO RETURN TO USER
		},
	});

	// 9. List all the tools that will be used by the agent during execution
	const tools = [WikipediaQuery, oneShot, fetchCryptoPrice, fetchNBAGames];

	// 10. Initialize the agent executor, which will use the specified tools and model to process input
	//https://js.langchain.com/docs/api/agents/functions/initializeAgentExecutorWithOptions
	const executor = await initializeAgentExecutorWithOptions(tools, model, {
		agentType: "openai-functions",
	});

	// 11. Extract the most recent input message from the array of messages
	//USED FOR TESTING PURPOSES. USE MESSAGES FROM AI LATER
	const input = messages[messages.length - 1].content;

	// 12. Execute the agent with the provided input to get a response
	const result = await executor.run(input);

	// 13. Break the result into individual word chunks for streaming
	const chunks = result.split(" ");

	// 14. Define the streaming mechanism to send chunks of data to the client

	//https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
	//FOR TESTING PURPOSES. CAN USE THE LANGCHAINSTREAM LATER ON
	const responseStream = new ReadableStream({
		async start(controller) {
			for (const chunk of chunks) {
				const bytes = new TextEncoder().encode(chunk + " ");
				controller.enqueue(bytes);
				await new Promise((r) =>
					setTimeout(r, Math.floor(Math.random() * 20 + 10))
				);
			}
			controller.close();
		},
	});

	// 15. Send the created stream as a response to the client
	return new StreamingTextResponse(responseStream);

	//NORMALLY IT WOULD BE THIS
	// const { stream, handlers } = LangChainStream();
	// return new StreamingTextResponse(stream);
	//https://sdk.vercel.ai/docs/api-reference/langchain-stream#langchainstream
}

//NEED TO CREATE SEPARATE TOOLS FOR EACH ENDPOINT
//NEED TO USE MESSAGES ARRAY INSTEAD OF JUST LAST MESSAGE
//ALSO USE LANGCHAINSTREAM AND MESSAGE FROM AI
