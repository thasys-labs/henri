import json
import os

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from henri import SYSTEM_PROMPT, TOOLS

load_dotenv(".env.local")

router = APIRouter()
client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


class ChatRequest(BaseModel):
    messages: list


@router.post("/chat")
async def chat(req: ChatRequest):
    async def generate():
        current_tool_id = None
        current_tool_name = None
        tool_buffer = ""

        try:
            async with client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=500,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=req.messages,
            ) as stream:
                async for event in stream:
                    t = getattr(event, "type", None)

                    if t == "content_block_start":
                        block = getattr(event, "content_block", None)
                        if block and getattr(block, "type", None) == "tool_use":
                            current_tool_id = block.id
                            current_tool_name = block.name
                            tool_buffer = ""

                    elif t == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        if delta:
                            if getattr(delta, "type", None) == "text_delta":
                                yield f"data: {json.dumps({'text': delta.text})}\n\n"
                            elif getattr(delta, "type", None) == "input_json_delta":
                                tool_buffer += getattr(delta, "partial_json", "")

                    elif t == "content_block_stop":
                        if current_tool_id is not None:
                            try:
                                yield f"data: {json.dumps({'tool_use': {'id': current_tool_id, 'name': current_tool_name, 'input': json.loads(tool_buffer)}})}\n\n"
                            except json.JSONDecodeError:
                                pass
                            current_tool_id = None
                            current_tool_name = None
                            tool_buffer = ""

            yield "data: [DONE]\n\n"

        except anthropic.AuthenticationError:
            yield f"data: {json.dumps({'error': 'API-Schlüssel ungültig.'})}\n\n"
        except anthropic.RateLimitError:
            yield f"data: {json.dumps({'error': 'Zu viele Anfragen. Bitte kurz warten.'})}\n\n"
        except Exception as e:
            print(f"Error: {e}")
            yield f"data: {json.dumps({'error': 'Ein Fehler ist aufgetreten.'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
