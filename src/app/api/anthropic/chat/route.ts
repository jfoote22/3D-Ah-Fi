import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    // Return a message indicating this functionality is disabled
    return NextResponse.json({
      text: "Anthropic chat is currently disabled. Please configure ANTHROPIC_API_KEY in environment variables to enable this feature.",
      error: "API_KEY_MISSING",
      disabled: true
    }, { status: 503 });
  } catch (error) {
    console.error("Error in Anthropic chat route:", error);
    return NextResponse.json({
      error: "Internal server error",
    }, { status: 500 });
  }
}
