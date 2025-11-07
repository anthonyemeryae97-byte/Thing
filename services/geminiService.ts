
import { GoogleGenAI, Type } from "@google/genai";
import { WorkOrder, WorkOrderType, OfficeLocation, TripSettings, FinancialGoals, TripGoal, SuggestedTrip } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const goalExplanation: Record<TripGoal, string> = {
    [TripGoal.HOURLY_RATE]: "Maximize Hourly Rate: (Total Payout / Total Trip Time in Hours). This focuses on time efficiency.",
    [TripGoal.PER_MILE_RATE]: "Maximize Per-Mile Rate: (Total Payout / Total Miles). This focuses on fuel and vehicle cost efficiency.",
    [TripGoal.TOTAL_PAYOUT]: "Maximize Total Payout: The absolute highest sum of payouts from all completed stops.",
    [TripGoal.STOP_COUNT]: "Maximize Number of Stops: Completing as many jobs as possible, which is good for route density."
};

const tripColors = ['#4F46E5', '#059669', '#DB2777', '#D97706', '#6D28D9'];

export interface GenerateRouteParams {
    orders: WorkOrder[];
    workOrderTypes: WorkOrderType[];
    startLocation: string;
    endLocation: string;
    settings: TripSettings;
    goals: FinancialGoals;
    maxTrips?: number;
}

export interface RouteGenerationResult {
    suggestions: SuggestedTrip[];
    explanation?: string;
}

// Function to sanitize string inputs for the AI prompt to prevent injection or formatting issues.
const sanitizeForPrompt = (str: string): string => {
    if (!str) return '';
    // Replaces characters that could prematurely terminate strings or cause JSON parsing errors.
    return str.replace(/\\/g, '\\\\') // escape backslashes
              .replace(/"/g, '\\"')   // escape double quotes
              .replace(/\n/g, ' ');   // replace newlines with spaces
};

export const generateOptimalRoute = async (params: GenerateRouteParams): Promise<RouteGenerationResult> => {
    const { orders, workOrderTypes, startLocation, endLocation, settings, goals, maxTrips } = params;

    const getType = (typeName: string) => workOrderTypes.find(t => t.typeName === typeName);

    const formattedOrders = orders.map(o => {
        const type = getType(o.typeName);
        const serviceTime = Math.round((type?.defaultServiceTimeSeconds || 0) / 60);
        return (
            `- Order ID: ${o.id}\n` +
            `  Address: ${sanitizeForPrompt(o.address)}\n` +
            `  Payout: $${(o.baseRate + o.miscFee).toFixed(2)}\n` +
            `  Estimated Service Time: ${serviceTime} minutes\n` +
            `  Available After: ${o.startDate ? new Date(o.startDate).toLocaleString() : 'Immediate'}\n` +
            `  Due By: ${new Date(o.dueDate).toLocaleString()}`
        );
    }).join('\n');

    const priorities = settings.priorities
        .filter(p => p.enabled)
        .map((p, index) => `${index + 1}. ${goalExplanation[p.goal]}`)
        .join('\n');

    const systemInstruction = `You are an expert logistics and dispatch planner for a field service company. Your primary task is to take a list of available work orders and organize them into one or more efficient daily routes. You MUST ensure that EVERY work order provided is included in one of the suggested routes. First, group orders by geographic proximity (e.g., city or zip code), then construct routes. If a group is too small for a full route, combine it with a nearby group. Your response must be a valid JSON object following the provided schema. If you create multiple routes, you must provide an explanation for the split.`;
    
    const tripQuantityInstruction = maxTrips 
        ? `You MUST fit all orders into exactly ${maxTrips} routes. If this requires violating the hard constraints below, you MUST still generate the routes and add a 'violation_warning' field to your response for each trip that is over the limit, explaining which limit was exceeded and by how much.`
        : `If necessary, split orders into multiple routes to respect hard constraints.`;

    const prompt = `
        **Routing Task**

        1.  **Start & End Points:**
            - All routes must START at: ${sanitizeForPrompt(startLocation)}.
            - All routes must END at: ${sanitizeForPrompt(endLocation)}.

        2.  **Available Work Orders:**
        ${formattedOrders}

        3.  **Hard Constraints (MUST be respected PER ROUTE):**
            - Maximum Total Trip Time (including driving and service): ${settings.maxTripTimeSeconds / 3600} hours.
            - Maximum Total Mileage: ${settings.maxTripMileage} miles.

        4.  **Optimization Goals (Prioritize in this order):**
        ${priorities}
        
        5.  **Soft Goals (Consider these as tie-breakers):**
            - Aim for an hourly rate above $${goals.targetHourlyRate}.
            - Aim for a per-mile rate above $${goals.targetPerMileRate}.

        **Your Task:**
        - You MUST use ALL of the provided work orders.
        - ${tripQuantityInstruction}
        - For each route, determine the best order of stops.
        - Calculate estimated total travel time, mileage, and payout for each route.
        - Provide a name for each route and a brief reasoning for its composition.
        - If you create more than one route, provide an overall 'explanation' for why the split was necessary.

        **Output:**
        Return a single JSON object. Do not include any other text or markdown formatting.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            explanation: { type: Type.STRING, description: 'If multiple routes were created, explain why. Required only if more than one suggestion is returned.' },
            suggestions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'A descriptive name for the route, often based on geography (e.g., "North County Route").' },
                        stops: {
                            type: Type.ARRAY,
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    workOrderId: { type: Type.STRING, description: 'The ID of the work order for this stop.' },
                                    address: { type: Type.STRING, description: 'The full address of the work order for this stop.' },
                                }
                             },
                            description: 'An array of stop objects in the optimal route order.'
                        },
                        totalMinutes: { type: Type.INTEGER, description: 'The estimated total trip time in minutes (driving + service).' },
                        totalMiles: { type: Type.NUMBER, description: 'The estimated total mileage for the route.' },
                        estimatedPayout: { type: Type.NUMBER, description: 'The sum of payouts for all stops on the route.' },
                        reasoning: { type: Type.STRING, description: 'A brief explanation of why this route was chosen based on the priorities.' },
                        startLocation: { type: Type.STRING, description: 'The starting address for this route.'},
                        endLocation: { type: Type.STRING, description: 'The ending address for this route.'},
                        violation_warning: { type: Type.STRING, description: "If the trip exceeds a hard constraint due to a trip quantity limit, this field will contain an explanation." },
                    },
                    required: ['name', 'stops', 'totalMinutes', 'totalMiles', 'estimatedPayout', 'reasoning', 'startLocation', 'endLocation']
                }
            }
        },
        required: ['suggestions']
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const jsonResponse = JSON.parse(response.text.trim());
        
        if (jsonResponse && jsonResponse.suggestions) {
             const suggestionsWithIds = jsonResponse.suggestions.map((trip: Omit<SuggestedTrip, 'id' | 'color'>, index: number) => ({
                ...trip,
                id: `suggested-${Date.now()}-${index}`,
                color: tripColors[index % tripColors.length]
            }));

            return {
                suggestions: suggestionsWithIds,
                explanation: jsonResponse.explanation
            };
        }
        return { suggestions: [] };

    } catch (error) {
        console.error("Error generating optimal route:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
             throw new Error(`The AI planner returned a malformed response. This can sometimes happen with complex addresses. Please try again. Raw error: ${error.message}`);
        }
        throw new Error("The AI planner failed to generate a route. This could be due to network issues, restrictive constraints, or an invalid response format. Please try again.");
    }
};