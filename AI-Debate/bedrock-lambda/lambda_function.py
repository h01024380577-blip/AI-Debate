import json
import os
import boto3
from prompts import build_prompt

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

bedrock = boto3.client("bedrock-runtime", region_name=REGION)


def lambda_handler(event, context):
    try:
        body = event.get("body")
        payload = json.loads(body) if isinstance(body, str) else (body or event)

        system, user = build_prompt(payload)

        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": system}],
            messages=[
                {"role": "user", "content": [{"text": user}]}
            ],
            inferenceConfig={
                "temperature": 0.85,
                "maxTokens": 1024,
            },
        )

        content = response["output"]["message"]["content"][0]["text"].strip()

        return _json_response(200, {"content": content})
    except Exception as exc:
        print(f"[bedrock-lambda] error: {exc}")
        return _json_response(500, {"error": str(exc)})


def _json_response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload, ensure_ascii=False),
    }
